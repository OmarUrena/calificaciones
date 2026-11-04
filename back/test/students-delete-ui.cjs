// Start front on port 3100, then node test/students-delete-ui.cjs.
// All API requests and deletions are simulated. No real student is deleted.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const origin = 'http://localhost:3100';
const envPath = resolve(__dirname, '../../front/.env');
const env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
const storageKey = authUrl ? `sb-${new URL(authUrl).hostname.split('.')[0]}-auth-token` : null;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ['ADMIN', 'TEACHER']) {
      const context = await browser.newContext({ viewport: { width: role === 'ADMIN' ? 390 : 1280, height: 900 } });
      await context.addCookies([{ name: 'califapp_token', value: 'test-token', url: origin }]);
      await context.addInitScript((key) => {
        localStorage.setItem('califapp_token', 'test-token');
        if (key) localStorage.setItem(key, JSON.stringify({ access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
          expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user', email: 'test@example.test' } }));
      }, storageKey);
      const course = { id: 'course', schoolId: 'school', schoolYearId: 'year', name: '4to A', grade: '4to' };
      let students = [
        { id: 'student-a', schoolId: 'school', schoolYearId: 'year', courseId: 'course', listNumber: 1, firstName: 'Ana', lastName: 'Pérez', course },
        { id: 'student-b', schoolId: 'school', schoolYearId: 'year', courseId: 'course', listNumber: 2, firstName: 'Luis', lastName: 'Rodríguez', course },
      ];
      let deleteRequests = 0;
      let releaseDelete;
      let failDelete = true;
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
        const respond = (json, status = 200) => route.fulfill({ headers, json, status });
        if (request.isNavigationRequest() && url.origin === origin) return route.continue();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/auth/me')) return respond({ id: 'user', role, schoolId: 'school', fullName: 'Administración', school: { id: 'school', name: 'Escuela' }, activeSchoolYear: { id: 'year', name: '2026-2027' } });
        if (url.pathname.endsWith('/students/student-a') && request.method() === 'DELETE') {
          deleteRequests++;
          await new Promise((resolve) => { releaseDelete = resolve; });
          if (failDelete) return respond({ message: 'No se pudo eliminar el estudiante.' }, 503);
          const deleted = students[0];
          students = students.filter((student) => student.id !== 'student-a');
          return respond(deleted);
        }
        if (url.pathname.endsWith('/students')) return respond(students);
        if (url.pathname.endsWith('/courses')) return respond([course]);
        if (url.origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let accept = false;
      const confirmations = [];
      page.on('dialog', async (dialog) => {
        assert.equal(dialog.type(), 'confirm');
        confirmations.push(dialog.message());
        if (accept) await dialog.accept();
        else await dialog.dismiss();
      });
      await page.goto(`${origin}/students`);
      const row = page.getByRole('row').filter({ hasText: 'Ana' });
      await row.waitFor();
      const remove = row.getByRole('button', { name: 'Eliminar definitivamente', exact: true });
      if (role === 'TEACHER') {
        assert.equal(await page.getByRole('button', { name: 'Eliminar definitivamente', exact: true }).count(), 0);
        assert.equal(deleteRequests, 0);
      } else {
        await remove.click();
        assert.equal(deleteRequests, 0, 'Cancel must not send a DELETE request');
        assert.match(confirmations[0], /Ana Pérez/);
        assert.match(confirmations[0], /calificaciones y resultados académicos y técnicos/);
        assert.match(confirmations[0], /no se puede deshacer/);
        accept = true;
        await remove.click();
        await page.getByRole('button', { name: 'Eliminando...', exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelector('button[disabled]') !== null);
        assert.equal(await row.getByRole('button', { name: 'Eliminando...', exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('row').filter({ hasText: 'Luis' }).getByRole('button', { name: 'Eliminar definitivamente', exact: true }).isDisabled(), true);
        assert.equal(deleteRequests, 1);
        assert.ok(releaseDelete);
        releaseDelete();
        await page.getByText('No se pudo eliminar el estudiante.', { exact: true }).waitFor();
        assert.equal(await row.count(), 1, 'A failed deletion must leave the student visible');
        await remove.waitFor();
        failDelete = false;
        await remove.click();
        await page.getByRole('button', { name: 'Eliminando...', exact: true }).waitFor();
        assert.equal(deleteRequests, 2);
        releaseDelete();
        await page.getByText('Estudiante y calificaciones eliminados definitivamente.', { exact: true }).waitFor();
        assert.equal(await row.count(), 0);
        assert.equal(await page.getByRole('row').filter({ hasText: 'Luis' }).count(), 1);
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${role}: permanent deletion controls verified.`);
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
