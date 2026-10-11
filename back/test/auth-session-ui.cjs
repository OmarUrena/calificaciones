// Run against the production frontend on port 3100. All API/Auth calls are mocked.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { seedUiSession } = require('./ui-session-fixture.cjs');

const origin = 'http://localhost:3100';
const user = {
  id: 'user-1', fullName: 'Usuario de prueba', role: 'ADMIN', schoolId: 'school-1',
  school: { id: 'school-1', name: 'Escuela de prueba' },
  activeSchoolYear: { id: 'year-1', name: '2026-2027' },
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.UI_BROWSER_PATH });
  try {
    const context = await browser.newContext();
    await seedUiSession(context);
    let authStatus = 200;
    const authHeaders = [];
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/auth/me')) {
        authHeaders.push(request.headers().authorization);
        return route.fulfill({ status: authStatus, json: authStatus === 200 ? user : { message: 'Auth unavailable' }, headers });
      }
      if (url.pathname.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/auth/v1/token')) {
        return route.fulfill({ headers, json: {
          access_token: 'new-test-token', token_type: 'bearer', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'new-refresh-token',
          user: { id: 'test-user', aud: 'authenticated', role: 'authenticated', email: 'test@example.test' },
        } });
      }
      if (url.origin === origin) return route.continue();
      return route.fulfill({ json: [], headers });
    });

    const page = await context.newPage();
    await page.goto(`${origin}/dashboard`);
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();

    authStatus = 503;
    await page.reload();
    await page.getByText('No se pudo verificar la sesión. Comprueba tu conexión e inténtalo de nuevo.').waitFor();
    assert.match(page.url(), /\/dashboard$/);
    authStatus = 200;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();

    await page.evaluate(() => localStorage.setItem('califapp_last_activity', String(Date.now() - 2 * 60_000 - 1_000)));
    await page.getByRole('dialog', { name: 'Tu sesión está por terminar' }).waitFor();
    await page.getByRole('button', { name: 'Continuar sesión' }).click();
    await page.getByRole('dialog', { name: 'Tu sesión está por terminar' }).waitFor({ state: 'hidden' });
    assert.ok(await page.evaluate(() => Date.now() - Number(localStorage.getItem('califapp_last_activity')) < 5_000));

    await page.evaluate(() => localStorage.setItem('califapp_last_activity', String(Date.now() - 15 * 60_000 - 1_000)));
    await page.waitForURL(/\/login/);
    await page.getByText('Tu sesión terminó después de 15 minutos sin actividad.').waitFor();

    authStatus = 200;
    await page.getByLabel('Correo').fill('test@example.test');
    await page.getByLabel('Contraseña').fill('test-password');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL(/\/dashboard$/);
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    await page.waitForTimeout(500);
    assert.match(page.url(), /\/dashboard$/);

    await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) => /^sb-.*-auth-token$/.test(item));
      const session = JSON.parse(localStorage.getItem(key));
      session.access_token = 'expired-test-token';
      session.expires_at = Math.floor(Date.now() / 1000) - 1;
      localStorage.setItem(key, JSON.stringify(session));
    });
    await page.reload();
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    assert.equal(authHeaders.at(-1), 'Bearer new-test-token');

    authStatus = 401;
    await page.reload();
    await page.waitForURL(/\/login/);
    authStatus = 200;
    await page.getByLabel('Correo').fill('test@example.test');
    await page.getByLabel('Contraseña').fill('test-password');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL(/\/dashboard$/);
    await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
    await page.waitForTimeout(500);
    assert.match(page.url(), /\/dashboard$/);
    const secondTab = await context.newPage();
    await secondTab.goto(`${origin}/dashboard`);
    await secondTab.getByRole('heading', { name: 'Dashboard' }).waitFor();
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.waitForURL(/\/login/);
    await secondTab.waitForURL(/\/login/);
    await browser.close();
    console.log('Sesión: recarga, error temporal, aviso, inactividad, renovación, 401, nuevo login y dos pestañas OK');
  } finally {
    if (browser.isConnected()) await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
