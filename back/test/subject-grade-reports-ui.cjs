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
      let failOptions = true;
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
        if (url.pathname.endsWith('/reports/assignments/tech/grade-options')) {
          if (failOptions) { failOptions = false; return route.fulfill({ headers, status: 503, json: { message: 'No se pudieron cargar los RA.' } }); }
          return route.fulfill({ headers, json: { type: 'TECHNICAL', outcomes: [
            { id: 'ra1', code: 'RA1', name: 'Primer resultado', isActive: true },
            { id: 'ra2', code: 'RA2', name: 'Segundo resultado', isActive: true },
            { id: 'ra3', code: 'RA3', name: 'Resultado histórico', isActive: false },
          ] } });
        }
        if (/\/reports\/assignments\/(math|tech)\/grades$/.test(url.pathname)) {
          requests.push(url);
          await new Promise((resolve) => { release = resolve; reportStarted(); });
          if (fail) return route.fulfill({ headers, status: 503, json: { message: 'No se pudo generar el PDF. Inténtalo de nuevo.' } });
          const filename = url.pathname.includes('/math/') ? 'calificaciones-5to-A-Matematicas-P1-P3.pdf' : 'calificaciones-6to-B-Desarrollo-web-RA1-RA3.pdf';
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
        assert.equal(await page.getByText('PDF de calificaciones', { exact: true }).count(), 0);
      } else if (role === 'UNLINKED') {
        await page.getByText('Tu usuario no está vinculado a un maestro.').waitFor();
        assert.equal(await page.getByText('PDF de calificaciones', { exact: true }).count(), 0);
      } else {
        const math = page.getByRole('row').filter({ hasText: 'Matemáticas' });
        const tech = page.getByRole('row').filter({ hasText: 'Desarrollo web' });
        await math.waitFor();
        assert.equal(await page.getByText('Asignatura ajena', { exact: true }).count(), 0);
        await math.getByText('PDF de calificaciones', { exact: true }).click();
        const generate = math.getByRole('button', { name: 'Generar PDF seleccionado', exact: true });
        assert.equal(await generate.isDisabled(), true);
        assert.equal(await math.getByRole('checkbox').count(), 4);
        await math.getByRole('button', { name: 'Marcar todos', exact: true }).click();
        assert.equal(await math.locator('input[type="checkbox"]:checked').count(), 4);
        await math.getByRole('button', { name: 'Limpiar selección', exact: true }).click();
        assert.equal(await generate.isDisabled(), true);
        const p1 = math.getByRole('checkbox', { name: 'P1', exact: true });
        const p3 = math.getByRole('checkbox', { name: 'P3', exact: true });
        await p1.check();
        await p3.check();
        let started = new Promise((resolve) => { reportStarted = resolve; });
        await generate.click();
        await started;
        assert.equal(await math.getByRole('button', { name: 'Generando PDF...' }).isDisabled(), true);
        assert.equal(await p1.isDisabled(), true);
        assert.deepEqual(requests[0].searchParams.getAll('periods'), ['1', '3']);
        release();
        await math.getByRole('alert').filter({ hasText: 'No se pudo generar el PDF.' }).waitFor();
        assert.equal(await p1.isChecked(), true);
        assert.equal(await p3.isChecked(), true);
        fail = false;
        started = new Promise((resolve) => { reportStarted = resolve; });
        let download = page.waitForEvent('download');
        await generate.click();
        await started;
        release();
        assert.equal((await download).suggestedFilename(), 'calificaciones-5to-A-Matematicas-P1-P3.pdf');
        await tech.getByText('PDF de calificaciones', { exact: true }).click();
        await tech.getByRole('alert').filter({ hasText: 'No se pudieron cargar los RA.' }).waitFor();
        await tech.getByRole('button', { name: 'Reintentar' }).click();
        const ra1 = tech.getByRole('checkbox', { name: 'RA1', exact: true });
        const ra3 = tech.getByRole('checkbox', { name: 'RA3 (histórico)', exact: true });
        await ra1.waitFor();
        assert.equal(await tech.getByRole('button', { name: 'Generar PDF seleccionado', exact: true }).isDisabled(), true);
        await ra1.check();
        await ra3.check();
        started = new Promise((resolve) => { reportStarted = resolve; });
        download = page.waitForEvent('download');
        await tech.getByRole('button', { name: 'Generar PDF seleccionado', exact: true }).click();
        await started;
        assert.equal(requests.at(-1).searchParams.has('period'), false);
        assert.equal(requests.at(-1).searchParams.has('periods'), false);
        assert.deepEqual(requests.at(-1).searchParams.getAll('outcomeIds'), ['ra1', 'ra3']);
        release();
        assert.equal((await download).suggestedFilename(), 'calificaciones-6to-B-Desarrollo-web-RA1-RA3.pdf');
        assert.equal(requests.length, 3);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${role}: subject PDF controls, period selection, downloads and permissions verified.`);
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
