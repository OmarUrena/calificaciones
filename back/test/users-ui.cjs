// Run the production frontend on port 3100, then node test/users-ui.cjs.
// All API calls are simulated; no real accounts or database records are created.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = 'http://localhost:3100';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'TEACHER']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addCookies([{ name: 'califapp_token', value: 'test-token', url: origin }]);
      await context.addInitScript(() => localStorage.setItem('califapp_token', 'test-token'));
      const schools = [{ id: 'a', name: 'Escuela A', isActive: true }, { id: 'b', name: 'Escuela B', isActive: true }];
      const teachers = [{ id: 'ta', schoolId: 'a', name: 'Maestro disponible' }, { id: 'tb', schoolId: 'b', name: 'Maestro otra escuela' }, { id: 'tc', schoolId: 'a', name: 'Maestro ocupado' }];
      let users = [
        { id: 'self', fullName: 'Super actual', email: 'super@example.test', role: 'SUPER_ADMIN', schoolId: null, teacherId: null, isActive: true },
        { id: 'teacher', fullName: 'Docente existente', email: 'teacher@example.test', role: 'TEACHER', schoolId: 'a', teacherId: 'tc', isActive: true },
        ...Array.from({ length: 10 }, (_, i) => ({ id: `admin-${i}`, fullName: `Admin ${i}`, email: `admin${i}@example.test`, role: 'ADMIN', schoolId: 'b', teacherId: null, isActive: true })),
      ];
      const writes = [];
      let userRequests = 0;
      let failCreate = true;
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname.endsWith('/auth/me')) return route.fulfill({ headers, json: { ...users[0], role, schoolId: role === 'SUPER_ADMIN' ? null : 'a' } });
        if (url.pathname === '/api/users' || url.pathname.startsWith('/api/users/')) {
          userRequests++;
          if (request.method() === 'POST') {
            const values = request.postDataJSON();
            writes.push({ method: 'POST', values });
            if (failCreate) { failCreate = false; return route.fulfill({ headers, status: 409, json: { message: 'Ya existe un usuario con ese correo electrónico.' } }); }
            const { password, ...safe } = values;
            assert.equal(password, 'Example123!');
            const created = { ...safe, id: 'created' };
            users = [...users, created];
            return route.fulfill({ headers, json: created });
          }
          if (request.method() === 'PATCH') {
            const id = url.pathname.split('/').pop();
            const values = request.postDataJSON();
            writes.push({ method: 'PATCH', id, values });
            users = users.map((user) => user.id === id ? { ...user, ...values } : user);
            return route.fulfill({ headers, json: users.find((user) => user.id === id) });
          }
          return route.fulfill({ headers, json: users });
        }
        if (url.pathname === '/api/schools') return route.fulfill({ headers, json: schools });
        if (url.pathname === '/api/teachers') return route.fulfill({ headers, json: teachers });
        if (url.origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/users`);
      if (role !== 'SUPER_ADMIN') {
        await page.getByText('Solo el superadministrador puede acceder a la gestión de usuarios.').waitFor();
        assert.equal(userRequests, 0);
        assert.equal(await page.getByRole('button', { name: 'Crear usuario', exact: true }).count(), 0);
      } else {
        await page.getByText('12 usuario(s)', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
        await page.getByText('Página 2 de 2', { exact: true }).waitFor();
        await page.getByLabel('Buscar', { exact: true }).fill('Super actual');
        await page.getByText('Página 1 de 1', { exact: true }).waitFor();
        const selfRow = page.getByRole('row').filter({ hasText: 'super@example.test' });
        assert.equal(await selfRow.getByRole('button', { name: 'Desactivar', exact: true }).isDisabled(), true);
        await selfRow.getByRole('button', { name: 'Editar', exact: true }).click();
        assert.equal(await page.getByLabel('Rol', { exact: true }).isDisabled(), true);
        assert.equal(await page.getByLabel('Usuario activo', { exact: true }).isDisabled(), true);
        await page.getByLabel('Nombre completo').fill('Super actualizado');
        await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
        await page.locator('form').waitFor({ state: 'detached' });
        assert.equal(writes.at(-1).values.role, 'SUPER_ADMIN');
        assert.equal(writes.at(-1).values.isActive, true);
        await page.getByLabel('Buscar', { exact: true }).fill('');
        await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
        const form = page.locator('form');
        await page.getByLabel('Nombre completo').fill('  Nueva docente  ');
        await page.getByLabel('Correo electrónico', { exact: true }).fill('NEW@example.test');
        await page.getByLabel('Rol', { exact: true }).selectOption('TEACHER');
        await form.getByRole('button', { name: 'Crear usuario', exact: true }).click();
        await page.getByText('La contraseña debe tener al menos 8 caracteres.').waitFor();
        assert.equal(writes.length, 1);
        await page.getByLabel('Escuela', { exact: true }).selectOption('a');
        assert.deepEqual(await page.getByLabel('Maestro vinculado').locator('option').allTextContents(), ['Selecciona un maestro', 'Maestro disponible']);
        await page.getByLabel('Maestro vinculado').selectOption('ta');
        await page.getByLabel('Contraseña inicial').fill('Example123!');
        await form.getByRole('button', { name: 'Crear usuario', exact: true }).click();
        await page.getByText('Ya existe un usuario con ese correo electrónico.').waitFor();
        assert.equal(await page.getByLabel('Nombre completo').inputValue(), '  Nueva docente  ');
        await form.getByRole('button', { name: 'Crear usuario', exact: true }).click();
        await form.waitFor({ state: 'detached' });
        assert.deepEqual(writes.at(-1).values, { fullName: 'Nueva docente', email: 'new@example.test', role: 'TEACHER', schoolId: 'a', teacherId: 'ta', isActive: true, password: 'Example123!' });
        await page.getByLabel('Buscar', { exact: true }).fill('new@example.test');
        const createdRow = page.getByRole('row').filter({ hasText: 'new@example.test' });
        await createdRow.getByRole('button', { name: 'Desactivar', exact: true }).click();
        await createdRow.getByRole('cell', { name: 'Inactivo', exact: true }).waitFor();
        assert.deepEqual(writes.at(-1).values, { isActive: false });
        await createdRow.getByRole('button', { name: 'Activar', exact: true }).click();
        await createdRow.getByRole('cell', { name: 'Activo', exact: true }).waitFor();
        await createdRow.getByRole('button', { name: 'Editar', exact: true }).click();
        await page.getByLabel('Rol', { exact: true }).selectOption('SUPER_ADMIN');
        await page.getByLabel('Escuela (opcional)', { exact: true }).selectOption('');
        await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
        await form.waitFor({ state: 'detached' });
        assert.equal(writes.at(-1).values.teacherId, null);
        assert.equal(writes.at(-1).values.schoolId, null);
        assert.equal(Object.hasOwn(writes.at(-1).values, 'password'), false);
        await page.getByLabel('Buscar', { exact: true }).fill('');
        await page.getByLabel('Filtrar por escuela').selectOption('global');
        await page.getByText('2 usuario(s)', { exact: true }).waitFor();
        await page.getByLabel('Filtrar por rol').selectOption('TEACHER');
        await page.getByText('No hay usuarios que coincidan con los filtros.').waitFor();
        await page.getByLabel('Filtrar por escuela').selectOption('');
        await page.getByText('1 usuario(s)', { exact: true }).waitFor();
        await page.getByLabel('Filtrar por estado').selectOption('inactive');
        await page.getByText('No hay usuarios que coincidan con los filtros.').waitFor();
        await page.getByLabel('Filtrar por estado').selectOption('');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.setViewportSize({ width: 1440, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.deepEqual(errors, []);
      console.log(`Usuarios ${role}: OK`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
