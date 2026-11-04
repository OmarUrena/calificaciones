// Start front on port 3100, then node test/subject-grade-reports-ui.cjs.
// All API responses and PDF downloads are simulated; no real grades are read or changed.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const origin = 'http://localhost:3100';
const envPath = resolve(__dirname, '../../front/.env');
const env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
const storageKey = authUrl ? `sb-${new URL(authUrl).hostname.split('.')[0]}-auth-token` : null;
const assignments = [
  { id: 'math', schoolId: 'school', schoolYearId: 'year', teacherId: 'teacher', isActive: true,
    courseId: 'course-a', subjectId: 'math', course: { name: '5to A' }, subject: { name: 'Matemáticas', type: 'ACADEMIC' }, schoolYear: { name: '2026-2027' } },
  { id: 'tech', schoolId: 'school', schoolYearId: 'year', teacherId: 'teacher', isActive: true,
    courseId: 'course-b', subjectId: 'tech', course: { name: '6to B' }, subject: { name: 'Desarrollo web', type: 'TECHNICAL' }, schoolYear: { name: '2026-2027' } },
  { id: 'other', schoolId: 'school', schoolYearId: 'year', teacherId: 'other-teacher', isActive: true,
    courseId: 'course-a', subjectId: 'other', course: { name: '5to A' }, subject: { name: 'Asignatura ajena', type: 'ACADEMIC' } },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ['TEACHER', 'ADMIN', 'UNLINKED']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
      await context.addCookies([{ name: 'califapp_token', value: 'test-token', url: origin }]);
      await context.addInitScript((key) => {
        localStorage.setItem('califapp_token', 'test-token');
        if (key) localStorage.setItem(key, JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
          expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user', email: 'test@example.test' } }));
      }, storageKey);
      const requests = [];
      let fail = true;
      let release;
      let reportStarted;
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Expose-Headers': 'Content-Disposition' };
        if (request.isNavigationRequest() && url.origin === origin) return route.continue();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/auth/me')) return route.fulfill({ headers, json: { id: 'user', fullName: 'Docente',
          role: role === 'UNLINKED' ? 'TEACHER' : role, teacherId: role === 'UNLINKED' ? null : 'teacher', schoolId: 'school',
          school: { id: 'school', name: 'Escuela' }, activeSchoolYear: { id: 'year', name: '2026-2027' } } });
        if (url.pathname.endsWith('/teacher-assignments')) return route.fulfill({ headers, json: assignments });
        if (/\/reports\/assignments\/(math|tech)\/grades$/.test(url.pathname)) {
          requests.push(url);
          await new Promise((resolve) => { release = resolve; reportStarted(); });
          if (fail) return route.fulfill({ headers, status: 503, json: { message: 'No se pudo generar el PDF. Inténtalo de nuevo.' } });
          const filename = url.pathname.includes('/math/') ? 'calificaciones-5to-A-Matematicas-P3.pdf' : 'calificaciones-6to-B-Desarrollo-web-por-RA.pdf';
          return route.fulfill({ headers: { ...headers, 'Content-Disposition': `attachment; filename="${filename}"` }, contentType: 'application/pdf', body: '%PDF-test-register' });
        }
        if (url.origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/my-subjects`);
      if (role === 'ADMIN') {
        await page.getByText('Esta vista está disponible únicamente para docentes.').waitFor();
        assert.equal(await page.getByRole('button', { name: 'Descargar PDF' }).count(), 0);
      } else if (role === 'UNLINKED') {
        await page.getByText('Tu usuario no está vinculado a un maestro.').waitFor();
        assert.equal(await page.getByRole('button', { name: 'Descargar PDF' }).count(), 0);
      } else {
        const math = page.getByRole('row').filter({ hasText: 'Matemáticas' });
        const tech = page.getByRole('row').filter({ hasText: 'Desarrollo web' });
        await math.waitFor();
        assert.equal(await page.getByText('Asignatura ajena', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Descargar PDF', exact: true }).count(), 2);
        const period = math.getByRole('combobox');
        assert.deepEqual(await period.locator('option').allTextContents(), ['P1', 'P2', 'P3', 'P4']);
        await period.selectOption('3');
        let started = new Promise((resolve) => { reportStarted = resolve; });
        await math.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
        await started;
        assert.equal(await math.getByRole('button', { name: 'Generando PDF...' }).isDisabled(), true);
        assert.equal(await period.isDisabled(), true);
        assert.equal(requests[0].searchParams.get('period'), '3');
        release();
        await math.getByRole('alert').filter({ hasText: 'No se pudo generar el PDF.' }).waitFor();
        assert.equal(await period.inputValue(), '3');
        fail = false;
        started = new Promise((resolve) => { reportStarted = resolve; });
        let download = page.waitForEvent('download');
        await math.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
        await started;
        release();
        assert.equal((await download).suggestedFilename(), 'calificaciones-5to-A-Matematicas-P3.pdf');
        assert.equal(await tech.getByRole('combobox').count(), 0);
        await tech.getByText('Registro completo por RA').waitFor();
        started = new Promise((resolve) => { reportStarted = resolve; });
        download = page.waitForEvent('download');
        await tech.getByRole('button', { name: 'Descargar PDF', exact: true }).click();
        await started;
        assert.equal(requests.at(-1).searchParams.has('period'), false);
        release();
        assert.equal((await download).suggestedFilename(), 'calificaciones-6to-B-Desarrollo-web-por-RA.pdf');
        assert.equal(requests.length, 3);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${role}: subject PDF controls, period selection, downloads and permissions verified.`);
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
