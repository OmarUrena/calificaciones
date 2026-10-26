// Run the production frontend on port 3100. No real accounts or emails are created.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = 'http://localhost:3100';
const email = 'angelica.bonillame1.@docente.edu.do';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: 'califapp_token', value: 'test-token', url: origin }]);
    await context.addInitScript(() => localStorage.setItem('califapp_token', 'test-token'));
    const root = { id: 'root', email: 'root@example.test', fullName: 'Superadministrador', role: 'SUPER_ADMIN', isActive: true };
    const teacher = { id: 'teacher', schoolId: 'school', name: 'Angélica Bonilla' };
    let users = [root];
    let signedIn = false;
    const writes = [];
    const logins = [];
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
      if (request.method() === 'OPTIONS') return route.fulfill({ headers, status: 204 });
      if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname.endsWith('/auth/v1/token')) {
        const credentials = request.postDataJSON();
        logins.push(credentials);
        assert.equal(credentials.email, email);
        signedIn = true;
        const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'account', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-signature`;
        return route.fulfill({ headers, json: { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user: { id: 'account', email, aud: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} } } });
      }
      if (url.pathname.endsWith('/auth/me')) return route.fulfill({ headers, json: signedIn ? users.find((user) => user.id === 'account') : root });
      if (url.pathname.endsWith('/users') && request.method() === 'POST') {
        const { password, ...values } = request.postDataJSON();
        assert.equal(password, 'Example123!');
        assert.equal(values.email, email);
        writes.push(values);
        const user = { ...values, id: 'account' };
        users.push(user);
        return route.fulfill({ headers, json: user });
      }
      if (url.pathname.endsWith('/users/account') && request.method() === 'PATCH') {
        const values = request.postDataJSON();
        assert.equal(values.email, email);
        writes.push(values);
        users = users.map((user) => user.id === 'account' ? { ...user, ...values } : user);
        return route.fulfill({ headers, json: users.find((user) => user.id === 'account') });
      }
      if (url.pathname.endsWith('/users')) return route.fulfill({ headers, json: users });
      if (url.pathname.endsWith('/schools')) return route.fulfill({ headers, json: [{ id: 'school', name: 'Escuela de prueba', isActive: true }] });
      if (url.pathname.endsWith('/teachers')) return route.fulfill({ headers, json: [teacher] });
      if (url.pathname.endsWith('/teacher-assignments')) return route.fulfill({ headers, json: [] });
      if (url.origin === origin) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/users`);
    await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    const form = page.locator('form');
    await page.getByLabel('Nombre completo').fill('Angélica Bonilla');
    await page.getByLabel('Correo electrónico', { exact: true }).fill('angelica..@docente.edu.do');
    await page.getByLabel('Rol', { exact: true }).selectOption('TEACHER');
    await page.getByLabel('Escuela', { exact: true }).selectOption('school');
    await page.getByLabel('Maestro vinculado').selectOption('teacher');
    await page.getByLabel('Contraseña inicial').fill('Example123!');
    await form.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await page.getByText('Introduce un correo válido.', { exact: true }).waitFor();
    assert.equal(writes.length, 0);
    await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await form.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await form.waitFor({ state: 'detached' });
    const row = page.getByRole('row').filter({ hasText: email });
    await row.getByRole('button', { name: 'Editar', exact: true }).click();
    assert.equal(await page.getByLabel('Correo electrónico', { exact: true }).inputValue(), email);
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await form.waitFor({ state: 'detached' });
    assert.equal(writes.length, 2);
    await page.goto(`${origin}/login`);
    await page.getByLabel('Correo', { exact: true }).fill('angelica..@docente.edu.do');
    await page.getByLabel('Contraseña', { exact: true }).fill('Example123!');
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await page.getByText('Introduce un correo válido.', { exact: true }).waitFor();
    assert.equal(logins.length, 0);
    await page.getByLabel('Correo', { exact: true }).fill(`  ${email.toUpperCase()}  `);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await page.waitForURL('**/my-subjects');
    await page.getByRole('heading', { name: 'Mis asignaturas', exact: true }).waitFor();
    assert.equal(logins.length, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('Correo institucional: creación, edición, validación y acceso conservan el punto final.');
    await context.close();
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
