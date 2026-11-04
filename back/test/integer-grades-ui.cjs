// Run front on port 3100, then node test/integer-grades-ui.cjs. All API writes are simulated.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const origin = 'http://localhost:3100';
const envPath = resolve(__dirname, '../../front/.env');
const env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
const storageKey = authUrl ? `sb-${new URL(authUrl).hostname.split('.')[0]}-auth-token` : null;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const type of ['ACADEMIC', 'TECHNICAL']) {
      const context = await browser.newContext();
      await context.addCookies([{ name: 'califapp_token', value: 'test-token', url: origin }]);
      await context.addInitScript((key) => {
        localStorage.setItem('califapp_token', 'test-token');
        if (key) localStorage.setItem(key, JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
          expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user', email: 'test@example.test' } }));
      }, storageKey);
      const course = { id: 'course', schoolId: 'school', schoolYearId: 'year', name: '4to A', grade: '4to' };
      const subject = { id: 'subject', schoolId: 'school', name: 'Asignatura', type, isActive: true };
      const student = { id: 'student', schoolId: 'school', schoolYearId: 'year', courseId: 'course', listNumber: 1, firstName: 'Ana', lastName: 'Pérez' };
      const academicFields = ['p1', 'rp1', 'p2', 'rp2', 'p3', 'rp3', 'p4', 'rp4'];
      const fields = type === 'ACADEMIC' ? academicFields : ['ordinaryScore', 'recovery1Score', 'recovery2Score', 'specialScore'];
      const labels = type === 'ACADEMIC' ? fields.map((field) => field.toUpperCase()) : ['Ordinaria', 'Recuperación 1', 'Recuperación 2', 'Especial'];
      const base = Object.fromEntries(fields.map((field, index) => [field, type === 'ACADEMIC' ? (field.startsWith('rp') ? 30 : 20) : index + 5]));
      let grade = { id: 'grade', schoolId: 'school', schoolYearId: 'year', courseId: 'course', subjectId: 'subject', studentId: 'student',
        blockNumber: 1, learningOutcomeId: 'ra', ...base, pc: 30, validScore: 8 };
      const periods = Object.fromEntries(academicFields.map((field) => [`${field}Enabled`, true]));
      const writes = [];
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
        const respond = (json) => route.fulfill({ headers, json });
        if (request.isNavigationRequest() && url.origin === origin) return route.continue();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/auth/me')) return respond({ id: 'user', role: 'TEACHER', schoolId: 'school', fullName: 'Docente', school: { id: 'school', name: 'Escuela' }, activeSchoolYear: { id: 'year', name: '2026-2027' } });
        if (url.pathname.endsWith('/teacher-assignments')) return respond([{ id: 'assignment', schoolId: 'school', schoolYearId: 'year', courseId: 'course', subjectId: 'subject', teacherId: 'teacher', isActive: true, course, subject }]);
        if (url.pathname.endsWith('/register')) return respond({ course, subject, periods, students: [student], grades: [grade], results: [],
          learningOutcomes: [{ id: 'ra', schoolId: 'school', subjectId: 'subject', code: 'RA1', name: 'Resultado 1', weight: 100, order: 1, isActive: true }] });
        if (url.pathname.endsWith('/grade') && request.method() === 'PATCH') {
          writes.push(request.postDataJSON());
          grade = { ...grade, ...request.postDataJSON() };
          return respond({ grade, result: {} });
        }
        if (url.origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/grades/${type === 'ACADEMIC' ? 'academic' : 'technical'}?courseId=course&subjectId=subject`);
      for (const [index, field] of fields.entries()) {
        const input = page.getByRole('spinbutton', { name: `${labels[index]} de Ana Pérez`, exact: true });
        await input.waitFor();
        assert.equal(await input.getAttribute('step'), '1');
        await input.focus();
        await input.press('ArrowUp');
        assert.equal(Number(await input.inputValue()), base[field] + 1);
        await input.press('ArrowDown');
        assert.equal(Number(await input.inputValue()), base[field]);
        await input.fill(`${base[field]}.5`);
        assert.equal(await input.getAttribute('aria-invalid'), 'true');
        await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
        await page.getByText('Revisa las calificaciones de Ana Pérez.', { exact: true }).first().waitFor();
        assert.equal(writes.length, 0, `${field}: decimals must not be sent or rounded`);
        await input.fill(`${base[field]}.0`);
        assert.equal(await input.getAttribute('aria-invalid'), 'false');
        assert.equal(Number(await input.inputValue()), base[field]);
      }
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await page.getByText(type === 'ACADEMIC' ? 'Bloque 1 guardado correctamente.' : 'RA1 guardado correctamente.', { exact: true }).waitFor();
      assert.equal(writes.length, 1);
      assert.ok(Object.values(writes[0]).every((value) => value === null || Number.isInteger(value)));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${type}: all ordinary/recovery inputs step by one, reject fractions and save whole values.`);
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
