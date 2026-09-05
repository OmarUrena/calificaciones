// Run against the frontend: npm run start -- --port 3100 (in front/).
// All API requests are mocked; this test never writes to the real backend.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { Workbook } = require('exceljs');

const origin = 'http://localhost:3100';
const year = { id: 'year', name: '2026-2027' };
const course = { id: 'course', name: '4to A', schoolId: 'school', schoolYearId: year.id, schoolYear: year };
const assignments = [
  { id: 'a', course, courseId: course.id, subjectId: 'academic', subject: { id: 'academic', name: 'Matemática', type: 'ACADEMIC', isActive: true }, teacherId: 'teacher', schoolYearId: year.id, isActive: true },
  { id: 't', course, courseId: course.id, subjectId: 'technical', subject: { id: 'technical', name: 'Desarrollo web', type: 'TECHNICAL', isActive: true }, teacherId: 'teacher', schoolYearId: year.id, isActive: true },
  { id: 'other', course, courseId: course.id, subjectId: 'other', subject: { id: 'other', name: 'Asignatura ajena', type: 'ACADEMIC', isActive: true }, teacherId: 'other-teacher', schoolYearId: year.id, isActive: true },
];

(async () => {
  const workbook = new Workbook();
  workbook.addWorksheet('Datos').addRows([['numero_lista', 'asignatura', 'B1_P1'], [1, 'Matemática', 80]]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ['ADMIN', 'TEACHER']) {
      const context = await browser.newContext({ viewport: { width: role === 'ADMIN' ? 1280 : 390, height: 844 }, acceptDownloads: true });
      await context.addCookies([{ name: 'califapp_token', value: 'test-only', url: origin }]);
      await context.addInitScript(() => localStorage.setItem('califapp_token', 'test-only'));
      const user = { id: 'user', fullName: 'Usuario de prueba', role, teacherId: 'teacher', schoolId: 'school', school: { id: 'school', name: 'Escuela de prueba' }, activeSchoolYear: year };
      const requests = [];
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (path.endsWith('/auth/me')) return route.fulfill({ json: user, headers });
        if (path.endsWith('/teacher-assignments')) return route.fulfill({ json: assignments, headers });
        if (path.endsWith('/courses')) return route.fulfill({ json: [course], headers });
        if (path.endsWith('/imports/template')) {
          assert.equal(url.searchParams.get('courseId'), course.id);
          return route.fulfill({ body: buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers });
        }
        if (/\/imports\/(students|academic-grades|technical-grades)$/.test(path)) {
          requests.push({ path, body: route.request().postDataBuffer().toString() });
          await new Promise((resolve) => setTimeout(resolve, 300));
          return route.fulfill({ headers, json: { jobId: 'job', status: 'COMPLETED', totalRows: 2, successRows: 1, errorRows: 1, errors: ['Fila 4: RP1 no puede ser menor que P1.'] } });
        }
        if (url.origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.goto(`${origin}/imports?type=academic&courseId=course&subjectId=academic`);
      await page.getByRole('button', { name: 'Descargar plantilla' }).waitFor();
      assert.equal(await page.getByRole('combobox', { name: /^Curso/ }).inputValue(), course.id);
      if (role === 'TEACHER') {
        assert.equal(await page.getByRole('button', { name: 'Estudiantes', exact: true }).count(), 0);
        assert.equal(await page.getByRole('option', { name: 'Asignatura ajena' }).count(), 0);
      }
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Descargar plantilla' }).click();
      assert.equal((await downloadPromise).suggestedFilename(), 'plantilla-academic.xlsx');
      await page.getByLabel('Archivo Excel', { exact: true }).setInputFiles({ name: 'datos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
      await page.getByRole('button', { name: 'Importar', exact: true }).click();
      await page.getByRole('heading', { name: 'Importación completada con errores' }).waitFor();
      assert.equal(await page.getByRole('cell', { name: '4', exact: true }).count(), 1);
      assert.match(requests[0].path, /academic-grades$/);
      assert.match(requests[0].body, /name="subjectId"\r\n\r\nacademic/);
      assert.match(requests[0].body, /name="schoolYearId"\r\n\r\nyear/);
      assert.equal(await page.getByRole('button', { name: 'Importar', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Calificaciones técnicas', exact: true }).click();
      await page.getByRole('combobox', { name: /^Curso/ }).selectOption('course');
      await page.getByRole('combobox', { name: /^Módulo técnico/ }).selectOption('technical');
      assert.equal(await page.getByRole('heading', { name: 'Importación completada con errores' }).count(), 0);
      await page.getByLabel('Archivo Excel', { exact: true }).setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
      await page.getByRole('alert').filter({ hasText: 'Selecciona un archivo Excel' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Importar', exact: true }).isDisabled(), true);
      await page.getByLabel('Archivo Excel', { exact: true }).setInputFiles({ name: 'datos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
      await page.getByRole('button', { name: 'Importar', exact: true }).click();
      await page.getByRole('heading', { name: 'Importación completada con errores' }).waitFor();
      assert.match(requests[1].path, /technical-grades$/);
      if (role === 'ADMIN') {
        await page.getByRole('button', { name: 'Estudiantes', exact: true }).click();
        await page.getByRole('combobox', { name: /^Curso/ }).selectOption('course');
        await page.getByLabel('Archivo Excel', { exact: true }).setInputFiles({ name: 'datos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
        await page.getByRole('button', { name: 'Importar', exact: true }).click();
        await page.getByRole('heading', { name: 'Importación completada con errores' }).waitFor();
        assert.match(requests[2].path, /students$/);
        assert.doesNotMatch(requests[2].body, /name="subjectId"/);
      } else {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
        await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
      }
      assert.deepEqual(pageErrors, []);
      console.log(`UI ${role}: selección, descarga, envío, errores y adaptación móvil OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });

