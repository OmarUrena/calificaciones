// Start the frontend on port 3100, then node test/academic-periods-ui.cjs.
// All API requests are simulated; no real database writes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const origin = 'http://localhost:3100';
const fields = ['p1', 'rp1', 'p2', 'rp2', 'p3', 'rp3', 'p4', 'rp4'];
const frontendEnvPath = resolve(__dirname, '../../front/.env');
const frontendEnv = existsSync(frontendEnvPath) ? readFileSync(frontendEnvPath, 'utf8') : '';
const publicAuthUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? frontendEnv
  .match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
const authStorageKey = publicAuthUrl ? `sb-${new URL(publicAuthUrl).hostname.split('.')[0]}-auth-token` : null;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ['ADMIN', 'TEACHER']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addCookies([{ name: 'califapp_token', value: 'test-token', url: origin }]);
      await context.addInitScript((storageKey) => {
        localStorage.setItem('califapp_token', 'test-token');
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify({
          access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'user', email: 'test@example.test' },
        }));
      }, authStorageKey);
      let periods = Object.fromEntries(fields.map((field) => [`${field}Enabled`, true]));
      let year = { id: 'year', schoolId: 'school', name: '2026-2027', isActive: true, ...periods };
      const course = { id: 'course', schoolId: 'school', schoolYearId: 'year', name: '4to A', grade: '4to' };
      const subject = { id: 'subject', schoolId: 'school', name: 'Matemática', type: 'ACADEMIC', isActive: true };
      const student = { id: 'student', schoolId: 'school', schoolYearId: 'year', courseId: 'course', listNumber: 1, firstName: 'Ana', lastName: 'Pérez' };
      let grade = { id: 'grade', schoolId: 'school', schoolYearId: 'year', courseId: 'course', subjectId: 'subject', studentId: 'student', blockNumber: 1,
        ...Object.fromEntries(fields.map((field) => [field, null])), p1: 60, rp1: 75, pc: null };
      const patches = [];
      const gradeWrites = [];
      let failNext = false;
      let legacyApi = false;
      let legacyValidation = false;
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
        const respond = (json, status = 200) => route.fulfill({ headers, json, status });
        if (request.isNavigationRequest() && url.origin === origin) return route.continue();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/auth/me')) return respond({
          id: 'user', role, schoolId: 'school', fullName: 'Usuario de prueba', school: { id: 'school', name: 'Escuela' }, activeSchoolYear: { id: 'year', name: year.name },
        });
        if (url.pathname.endsWith('/school-years/year')) {
          const values = request.postDataJSON();
          if (legacyValidation) return respond({ message: ['property rp3Enabled should not exist'] }, 400);
          if (failNext) { failNext = false; return respond({ message: 'No se pudo actualizar el período.' }, 503); }
          patches.push(values);
          year = { ...year, ...values };
          periods = Object.fromEntries(fields.map((field) => [`${field}Enabled`, year[`${field}Enabled`]]));
          return respond(year);
        }
        if (url.pathname.endsWith('/school-years')) return respond([legacyApi
          ? { id: year.id, schoolId: year.schoolId, name: year.name, isActive: year.isActive }
          : year]);
        if (url.pathname.endsWith('/teacher-assignments')) return respond([{
          id: 'assignment', schoolId: 'school', schoolYearId: 'year', courseId: 'course', subjectId: 'subject', teacherId: 'teacher', isActive: true, course, subject,
        }]);
        if (url.pathname.endsWith('/academic-grades/course/course/subject/subject/register')) {
          return respond({ course, subject, periods, students: [student], grades: [grade], results: [] });
        }
        if (url.pathname.endsWith('/academic-grades/grade')) {
          gradeWrites.push(request.postDataJSON());
          grade = { ...grade, ...request.postDataJSON() };
          return respond({ grade, result: {} });
        }
        if (url.origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/school-years`);
      if (role === 'ADMIN') {
        await page.getByRole('switch').first().waitFor();
        assert.equal(await page.getByRole('switch').count(), 8);
        const p1Switch = page.getByRole('switch', { name: 'P1 de 2026-2027', exact: true });
        const rp1Switch = page.getByRole('switch', { name: 'RP1 de 2026-2027', exact: true });
        await p1Switch.click();
        await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="P1 de 2026-2027"]')?.getAttribute('aria-checked') === 'false');
        assert.equal(await rp1Switch.getAttribute('aria-checked'), 'true');
        assert.deepEqual(patches, [{ p1Enabled: false }]);
        await p1Switch.click();
        await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="P1 de 2026-2027"]')?.getAttribute('aria-checked') === 'true');
        failNext = true;
        await rp1Switch.click();
        await page.getByRole('alert').filter({ hasText: 'No se pudo actualizar el período.' }).waitFor();
        assert.equal(await rp1Switch.getAttribute('aria-checked'), 'true');
        await rp1Switch.click();
        await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="RP1 de 2026-2027"]')?.getAttribute('aria-checked') === 'false');
        assert.equal(await p1Switch.getAttribute('aria-checked'), 'true');
        legacyValidation = true;
        await page.getByRole('switch', { name: 'RP3 de 2026-2027', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'El servicio de calificaciones necesita actualizarse' }).waitFor();
        assert.equal(await page.getByRole('switch', { name: 'RP3 de 2026-2027', exact: true }).getAttribute('aria-checked'), 'true');
        legacyValidation = false;
        legacyApi = true;
        await page.reload();
        await page.getByRole('alert').filter({ hasText: 'El servicio de calificaciones necesita actualizarse' }).waitFor();
        assert.equal(await page.getByRole('switch').count(), 0, 'missing states must not appear as inactive');
        legacyApi = false;
      } else {
        await page.getByText('Solo usuarios administrativos pueden gestionar años escolares.').waitFor();
        assert.equal(await page.getByRole('switch').count(), 0);
      }

      // Closed P1 with open RP1: ordinary input stays disabled and recovery remains editable.
      periods = { ...periods, p1Enabled: false, rp1Enabled: true };
      await page.goto(`${origin}/grades/academic?courseId=course&subjectId=subject`);
      const p1 = page.getByRole('spinbutton', { name: 'P1 de Ana Pérez', exact: true });
      const rp1 = page.getByRole('spinbutton', { name: 'RP1 de Ana Pérez', exact: true });
      await p1.waitFor();
      assert.equal(await p1.isDisabled(), true);
      assert.equal(await rp1.isEnabled(), true);
      assert.equal(await p1.inputValue(), '60');
      await rp1.fill('80');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await page.getByText('Bloque 1 guardado correctamente.').waitFor();
      assert.equal(gradeWrites.at(-1).rp1, 80);
      assert.equal(gradeWrites.at(-1).p1, 60);

      // Open P1 with closed RP1: editing P1 preserves the saved recovery.
      periods = { ...periods, p1Enabled: true, rp1Enabled: false };
      await page.reload();
      await p1.waitFor();
      assert.equal(await p1.isEnabled(), true);
      assert.equal(await rp1.isDisabled(), true);
      assert.equal(await rp1.inputValue(), '80');
      await p1.fill('65');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await page.getByText('Bloque 1 guardado correctamente.').waitFor();
      assert.equal(gradeWrites.at(-1).p1, 65);
      assert.equal(gradeWrites.at(-1).rp1, 80);
      const writesBefore = gradeWrites.length;
      await p1.fill('85');
      await page.getByText('RP1 está desactivado. Administración debe activar su edición antes de cambiar P1 de esta forma.').waitFor();
      assert.equal(await p1.inputValue(), '65');
      assert.equal(await rp1.inputValue(), '80');
      assert.equal(gradeWrites.length, writesBefore);

      // Existing eligibility rules still apply when recovery editing is enabled.
      periods = { ...periods, rp1Enabled: true };
      grade = { ...grade, p1: 85, rp1: null };
      await page.reload();
      await p1.waitFor();
      assert.equal(await rp1.isDisabled(), true);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${role}: independent P/RP controls, read-only values, saves and recovery rules verified.`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
