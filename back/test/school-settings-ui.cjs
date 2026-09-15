// Start the frontend on port 3100, then node test/school-settings-ui.cjs.
// API and image requests are simulated. No real database or Storage writes occur.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = 'http://localhost:3100';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEAAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ['ADMIN', 'TEACHER', 'SUPER_ADMIN']) {
      const context = await browser.newContext({ viewport: { width: role === 'ADMIN' ? 390 : 1280, height: 844 } });
      await context.addCookies([{ name: 'califapp_token', value: 'test-token', url: origin }]);
      await context.addInitScript(() => localStorage.setItem('califapp_token', 'test-token'));
      let school = { id: 'school-a', name: 'Escuela original', code: 'A', address: 'Dirección anterior', phone: '123', logoUrl: null, isActive: true };
      let failUpload = true;
      const patches = [];
      const schoolRequests = [];
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/auth/me')) return route.fulfill({ headers, json: {
          id: 'user', role, schoolId: role === 'SUPER_ADMIN' ? null : school.id,
          fullName: 'Usuario de prueba', school: { id: school.id, name: school.name },
          activeSchoolYear: { id: 'year', name: '2026-2027' },
        } });
        if (url.pathname.includes('/schools')) {
          schoolRequests.push(url.pathname);
          if (url.pathname.endsWith('/logo')) {
            assert.equal(request.method(), 'POST');
            assert.match(request.headers()['content-type'], /multipart\/form-data/);
            if (failUpload) { failUpload = false; return route.fulfill({ headers, status: 503, json: { message: 'No se pudo guardar el logo. Inténtalo de nuevo.' } }); }
            school = { ...school, logoUrl: 'https://images.example.test/logo.png' };
          } else if (request.method() === 'PATCH') {
            const values = request.postDataJSON();
            patches.push(values);
            school = { ...school, ...values };
          } else if (url.pathname.endsWith('/schools')) return route.fulfill({ headers, json: [school] });
          return route.fulfill({ headers, json: school });
        }
        if (url.hostname === 'images.example.test') return route.fulfill({ contentType: 'image/png', body: png });
        if (url.origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/settings`);
      if (role === 'TEACHER') {
        await page.getByText('No tienes permiso para configurar la escuela.').waitFor();
        assert.equal(await page.getByRole('button', { name: 'Guardar datos' }).count(), 0);
        assert.deepEqual(schoolRequests, []);
      } else {
        if (role === 'SUPER_ADMIN') await page.getByLabel('Escuela', { exact: true }).selectOption('school-a');
        const name = page.getByLabel('Nombre de la institución', { exact: false });
        await name.waitFor();
        assert.equal(await name.inputValue(), 'Escuela original');
        assert.equal(await page.getByRole('button', { name: 'Guardar datos', exact: true }).isDisabled(), true);
        await name.fill('   ');
        await page.getByRole('button', { name: 'Guardar datos', exact: true }).click();
        await page.getByText('El nombre de la institución es obligatorio.').waitFor();
        assert.equal(patches.length, 0);
        await name.fill('  Escuela actualizada  ');
        await page.getByLabel('Dirección', { exact: true }).fill('');
        await page.getByLabel('Teléfono', { exact: true }).fill('');
        await page.getByRole('button', { name: 'Guardar datos', exact: true }).click();
        await page.getByText('Datos de la escuela guardados.').waitFor();
        assert.deepEqual(patches[0], { name: 'Escuela actualizada', code: 'A', address: '', phone: '' });
        await page.getByText('Escuela actualizada', { exact: false }).first().waitFor();
        await name.fill('Borrador sin guardar');
        const input = page.getByLabel('Imagen del logo', { exact: true });
        await input.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') });
        await page.getByText('Selecciona una imagen PNG, JPG o WebP válida de hasta 2 MB.').waitFor();
        assert.equal(await page.getByRole('button', { name: 'Guardar logo', exact: true }).isDisabled(), true);
        await input.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
        await page.getByRole('img', { name: 'Vista previa del logo institucional' }).waitFor();
        await page.getByRole('button', { name: 'Guardar logo', exact: true }).click();
        await page.getByText('No se pudo guardar el logo. Inténtalo de nuevo.').waitFor();
        assert.equal(await name.inputValue(), 'Borrador sin guardar');
        await page.getByRole('button', { name: 'Guardar logo', exact: true }).click();
        await page.getByText('Logo guardado. Se usará en los próximos boletines.').waitFor();
        assert.equal(await name.inputValue(), 'Borrador sin guardar');
        assert.equal(await page.getByRole('img', { name: 'Vista previa del logo institucional' }).getAttribute('src'), school.logoUrl);
        assert.equal(await page.getByRole('button', { name: 'Guardar logo', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: 'Restablecer', exact: true }).click();
        assert.equal(await name.inputValue(), 'Escuela actualizada');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.reload();
        if (role === 'SUPER_ADMIN') await page.getByLabel('Escuela', { exact: true }).selectOption('school-a');
        await name.waitFor();
        assert.equal(await name.inputValue(), 'Escuela actualizada');
        assert.equal(await page.getByLabel('Dirección', { exact: true }).inputValue(), '');
      }
      assert.deepEqual(errors, []);
      console.log(`Configuración ${role}: OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
