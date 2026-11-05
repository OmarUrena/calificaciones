// Start front on port 3100. All Auth/API requests are simulated; no live writes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const origin = 'http://localhost:3100';
const env = readFileSync(resolve(__dirname, '../../front/.env'), 'utf8');
const authUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
const storageKey = `sb-${new URL(authUrl).hostname.split('.')[0]}-auth-token`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'califapp_token', value: 'test-token', url: origin }]);
    await context.addInitScript((key) => {
      localStorage.setItem('califapp_token', 'test-token');
      localStorage.setItem(key, JSON.stringify({ access_token: 'test-token', refresh_token: 'revoked-refresh', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user', email: 'teacher@example.test' } }));
    }, storageKey);
    const course = { id: 'course', schoolId: 'school', schoolYearId: 'year', name: '4to A', grade: '4to' };
    const subject = { id: 'subject', schoolId: 'school', name: 'Matemática', type: 'ACADEMIC', isActive: true };
    const student = { id: 'student', schoolId: 'school', schoolYearId: 'year', courseId: 'course', listNumber: 1, firstName: 'Ana', lastName: 'Pérez' };
    const fields = ['p1', 'rp1', 'p2', 'rp2', 'p3', 'rp3', 'p4', 'rp4'];
    const periods = Object.fromEntries(fields.map((field) => [`${field}Enabled`, true]));
    const grade = { id: 'grade', schoolId: 'school', schoolYearId: 'year', courseId: 'course', subjectId: 'subject', studentId: 'student',
      blockNumber: 1, ...Object.fromEntries(fields.map((field) => [field, null])), p1: 20, pc: null };
    const writes = [];
    let refreshes = 0;
    let logins = 0;
    let passwordsAccepted = false;
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'X-Supabase-Api-Version': '2024-01-01' };
      const respond = (json, status = 200) => route.fulfill({ headers, json, status });
      if (request.isNavigationRequest() && url.origin === origin) return route.continue();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname === '/auth/v1/token') {
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          refreshes++;
          return respond({ code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, 400);
        }
        assert.equal(url.searchParams.get('grant_type'), 'password');
        const credentials = request.postDataJSON();
        assert.equal(credentials.email, 'teacher@example.test', 'the editor must keep its original account');
        logins++;
        if (!passwordsAccepted) return respond({ code: 'invalid_credentials', msg: 'Contraseña incorrecta' }, 400);
        return respond({ access_token: 'reauthenticated', refresh_token: 'new-refresh', expires_in: 3600, token_type: 'bearer', user: { id: 'user', email: 'teacher@example.test' } });
      }
      if (url.pathname.endsWith('/auth/me')) return respond({ id: 'user', email: 'teacher@example.test', role: 'TEACHER', schoolId: 'school', fullName: 'Docente',
        school: { id: 'school', name: 'Escuela' }, activeSchoolYear: { id: 'year', name: '2026-2027' } });
      if (url.pathname.endsWith('/teacher-assignments')) return respond([{ id: 'assignment', schoolId: 'school', schoolYearId: 'year', courseId: 'course', subjectId: 'subject', teacherId: 'teacher', isActive: true, course, subject }]);
      if (url.pathname.endsWith('/register')) return respond({ course, subject, periods, students: [student], grades: [grade], results: [] });
      if (url.pathname.endsWith('/grade') && request.method() === 'PATCH') {
        assert.equal(request.headers().authorization, 'Bearer reauthenticated');
        writes.push(request.postDataJSON());
        return respond({ grade: { ...grade, ...writes.at(-1) }, result: {} });
      }
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    await page.clock.install();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/grades/academic?courseId=course&subjectId=subject`);
    const score = page.getByRole('spinbutton', { name: 'P1 de Ana Pérez', exact: true });
    await score.waitFor();
    await score.fill('85');
    await score.evaluate((element) => { window.sessionDraftInput = element; });
    const before = page.url();
    await page.clock.setSystemTime(new Date(Date.now() + 3 * 3600_000));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Continuar sesión', exact: true }).click();
    await page.getByLabel('Contraseña', { exact: true }).waitFor();
    assert.ok(refreshes > 0);
    await page.getByLabel('Contraseña', { exact: true }).fill('wrong-password');
    await dialog.getByRole('button', { name: 'Iniciar sesión y continuar', exact: true }).click();
    await dialog.getByText('Contraseña incorrecta', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Contraseña', { exact: true }).inputValue(), '');
    passwordsAccepted = true;
    await page.getByLabel('Contraseña', { exact: true }).fill('correct-password');
    await dialog.getByRole('button', { name: 'Iniciar sesión y continuar', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(logins, 2);
    assert.equal(page.url(), before, 'session recovery must not navigate');
    assert.equal(await score.inputValue(), '85', 'unsaved grade survives expiry and reauthentication');
    assert.equal(await score.evaluate((element) => element === window.sessionDraftInput), true, 'the editor remains mounted');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await page.getByText('Bloque 1 guardado correctamente.', { exact: true }).waitFor();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].p1, 85);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Browser recovery passed: expired/revoked session after three hours, failed/successful password, same mounted editor, draft retained and saved with the new token.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
