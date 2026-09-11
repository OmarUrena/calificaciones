// Run against the frontend: npm run start -- --port 3100 (in front/).
// API requests are mocked; this test never writes to the real backend.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const origin = 'http://localhost:3100';
const year = { id: 'year', name: '2026-2027', isActive: true };
const titularCourse = {
  id: 'course-titular',
  name: '4to. A Informática',
  schoolId: 'school',
  schoolYearId: year.id,
  titularId: 'teacher',
};
const otherCourse = {
  id: 'course-other',
  name: '4to. B Informática',
  schoolId: 'school',
  schoolYearId: year.id,
  titularId: 'other-teacher',
};
const students = [
  {
    id: 'student-2',
    schoolId: 'school',
    schoolYearId: year.id,
    courseId: titularCourse.id,
    listNumber: 2,
    firstName: 'Luis',
    lastName: 'Rodríguez',
  },
  {
    id: 'student-1',
    schoolId: 'school',
    schoolYearId: year.id,
    courseId: titularCourse.id,
    listNumber: 1,
    firstName: 'Ana',
    lastName: 'García',
  },
];
const pdf = Buffer.from('%PDF-1.4\n% CalifApp test\n');

async function preparePage(role) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addCookies([{ name: 'califapp_token', value: 'test-only', url: origin }]);
  await context.addInitScript(() => localStorage.setItem('califapp_token', 'test-only'));
  const user = {
    id: 'user',
    fullName: 'Usuario de prueba',
    role,
    teacherId: role === 'TEACHER' ? 'teacher' : null,
    schoolId: 'school',
    school: { id: 'school', name: 'Escuela de prueba' },
    activeSchoolYear: year,
  };
  const reportRequests = [];

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user, headers });
    if (path.endsWith('/school-years')) return route.fulfill({ json: [year], headers });
    if (path.endsWith('/courses')) {
      return route.fulfill({ json: [titularCourse, otherCourse], headers });
    }
    if (path.endsWith('/students')) return route.fulfill({ json: students, headers });
    if (path.includes('/reports/')) {
      reportRequests.push(`${path}${url.search}`);
      return route.fulfill({ body: pdf, contentType: 'application/pdf', headers });
    }
    if (url.origin === origin) return route.continue();
    return route.abort();
  });

  const page = await context.newPage();
  return { browser, page, reportRequests };
}

async function testAdminDownloads() {
  const { browser, page, reportRequests } = await preparePage('ADMIN');
  try {
    await page.goto(`${origin}/reports?courseId=${titularCourse.id}`);
    await page.getByRole('button', { name: 'Generar boletines del curso' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Curso' }).inputValue(), titularCourse.id);
    assert.equal(await page.getByRole('combobox', { name: 'Año escolar' }).inputValue(), year.id);
    assert.deepEqual(
      await page.getByRole('combobox', { name: 'Estudiante (opcional)' }).locator('option').allTextContents(),
      ['Selecciona un estudiante', '1. Ana García', '2. Luis Rodríguez'],
    );

    await page.getByRole('combobox', { name: 'Período' }).selectOption('3');
    const courseDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generar boletines del curso' }).click();
    assert.match((await courseDownload).suggestedFilename(), /boletines-curso-.*-P3\.pdf/);

    await page.getByRole('combobox', { name: 'Estudiante (opcional)' }).selectOption('student-1');
    const studentDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generar boletín individual' }).click();
    assert.match((await studentDownload).suggestedFilename(), /boletin-estudiante-.*-P3\.pdf/);
    assert.deepEqual(reportRequests, [
      '/api/reports/courses/course-titular/report-cards?period=3',
      '/api/reports/students/student-1/report-card?period=3',
    ]);
  } finally {
    await browser.close();
  }
}

async function testTeacherPermissions() {
  const { browser, page } = await preparePage('TEACHER');
  try {
    await page.goto(`${origin}/reports?courseId=${titularCourse.id}`);
    const courseButton = page.getByRole('button', { name: 'Generar boletines del curso' });
    await courseButton.waitFor();
    assert.equal(await courseButton.isEnabled(), true);

    await page.getByRole('combobox', { name: 'Curso' }).selectOption(otherCourse.id);
    assert.equal(await courseButton.isDisabled(), true);
    await page.getByText('Solo el maestro titular de este curso').waitFor();
  } finally {
    await browser.close();
  }
}

(async () => {
  await testAdminDownloads();
  await testTeacherPermissions();
  console.log('UI reportes: filtros, descargas y permisos por titular OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
