// Build first: npm run build. Then node --test test/users.test.cjs. No real account/DB writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UsersService } = require('../dist/src/users/users.service');
const { UserAccountsService } = require('../dist/src/users/user-accounts.service');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');

const actor = { id: 'root', role: 'SUPER_ADMIN', schoolId: null };
const payload = { email: 'teacher@example.test', fullName: 'Docente de prueba', role: 'TEACHER', schoolId: 'school-a', teacherId: 'teacher-a', password: 'test-password', isActive: true };
function fixture() {
  const users = new Map([
    ['root', { id: 'root', role: 'SUPER_ADMIN', email: 'root@example.test', fullName: 'Root', schoolId: null, teacherId: null, isActive: true }],
    ['scoped-root', { id: 'scoped-root', role: 'SUPER_ADMIN', email: 'scoped@example.test', schoolId: 'school-a', teacherId: null, isActive: true }],
  ]);
  const events = [];
  const prisma = {
    school: { findUnique: async ({ where }) => ['school-a', 'school-b'].includes(where.id) ? { id: where.id } : null },
    teacher: { findFirst: async ({ where }) => where.id === 'teacher-a' && where.schoolId === 'school-a' ? { id: 'teacher-a' } : null },
    user: {
      findUnique: async ({ where }) => users.get(where.id) ?? null,
      findFirst: async ({ where }) => [...users.values()].find((user) =>
        (!where.id?.not || user.id !== where.id.not) &&
        (!where.email || user.email.toLowerCase() === where.email.equals.toLowerCase()) &&
        (!where.teacherId || user.teacherId === where.teacherId)) ?? null,
      create: async ({ data }) => { const record = { ...data, id: data.id ?? 'internal-id' }; users.set(record.id, record); return record; },
      update: async ({ where, data }) => { const record = { ...users.get(where.id), ...data }; users.set(where.id, record); return record; },
    },
  };
  const accounts = {
    create: async (...args) => { events.push(['auth-create', ...args]); return 'auth-id'; },
    removeCreatedAccount: async (id) => events.push(['auth-delete', id]),
    find: async (id, email) => { events.push(['auth-find', id, email]); return 'auth-id'; },
    updateEmail: async (id, email) => events.push(['auth-email', id, email]),
  };
  const audit = [];
  const service = new UsersService(prisma, new PermissionsService(prisma), {
    logCreate: async (entry) => audit.push(entry), logUpdate: async (entry) => audit.push(entry), logDelete: async (entry) => audit.push(entry),
  }, accounts);
  return { service, prisma, users, accounts, events, audit };
}

test('creating an account links the Auth ID and never persists or audits the password', async () => {
  const { service, users, events, audit } = fixture();
  const created = await service.create(payload, actor);
  assert.equal(created.id, 'auth-id');
  assert.equal(users.get('auth-id').teacherId, 'teacher-a');
  assert.deepEqual(events[0], ['auth-create', payload.email, payload.password, payload.fullName]);
  assert.equal('password' in created, false);
  assert.equal(JSON.stringify(audit).includes(payload.password), false);
  assert.equal(JSON.stringify(audit).includes('password'), false);
});

test('DB creation failure only removes the newly created Auth account', async () => {
  const { service, prisma, events } = fixture();
  prisma.user.create = async () => { throw new Error('DB failure'); };
  await assert.rejects(() => service.create(payload, actor), /DB failure/);
  assert.deepEqual(events.at(-1), ['auth-delete', 'auth-id']);
});

test('duplicate emails, missing schools and invalid teacher links fail before Auth creation', async () => {
  const { service, events, users } = fixture();
  for (const invalid of [
    { ...payload, email: 'ROOT@example.test' }, { ...payload, schoolId: undefined },
    { ...payload, teacherId: undefined }, { ...payload, schoolId: 'school-b' },
    { ...payload, schoolId: 'missing' },
  ]) await assert.rejects(() => service.create(invalid, actor));
  users.set('linked', { id: 'linked', email: 'linked@example.test', schoolId: 'school-a', teacherId: 'teacher-a', role: 'TEACHER' });
  await assert.rejects(() => service.create(payload, actor), /ya tiene un usuario/);
  assert.deepEqual(events, []);
});

test('admins cannot manage superadmins, cross schools or escalate roles; own account remains active', async () => {
  const { service, users } = fixture();
  const admin = { id: 'admin', schoolId: 'school-a', role: 'ADMIN' };
  await assert.rejects(() => service.update('scoped-root', { role: 'ADMIN' }, admin), /permiso/);
  await assert.rejects(() => service.remove('scoped-root', admin), /permiso/);
  await assert.rejects(() => service.create({ ...payload, role: 'SUPER_ADMIN' }, admin));
  await assert.rejects(() => service.create({ ...payload, schoolId: 'school-b' }, admin));
  await assert.rejects(() => service.create(payload, { ...admin, role: 'TEACHER' }), /permiso/);
  await assert.rejects(() => service.update('root', { role: 'ADMIN', schoolId: 'school-a' }, actor), /propio rol/);
  await assert.rejects(() => service.remove('root', actor), /propia cuenta/);
  await assert.rejects(() => service.update('root', { isActive: false }, actor), /propia cuenta/);
  assert.equal(users.get('root').isActive, true);
});

test('editing validates effective school/teacher and can clear relationships when changing roles', async () => {
  const { service, users } = fixture();
  await service.create(payload, actor);
  await assert.rejects(() => service.update('auth-id', { schoolId: 'school-b' }, actor), /same school/);
  assert.equal(users.get('auth-id').schoolId, 'school-a');
  const changed = await service.update('auth-id', { role: 'SUPER_ADMIN', schoolId: null, teacherId: null }, actor);
  assert.equal(changed.schoolId, null);
  assert.equal(changed.teacherId, null);
  await service.update('auth-id', { isActive: false }, actor);
  assert.equal(users.get('auth-id').isActive, false);
  await service.update('auth-id', { isActive: true }, actor);
  assert.equal(users.get('auth-id').isActive, true);
});

test('email updates synchronize Auth and restore the previous email if the DB write fails', async () => {
  const { service, prisma, events } = fixture();
  await service.create(payload, actor);
  const updated = await service.update('auth-id', { email: 'new@example.test' }, actor);
  assert.equal(updated.email, 'new@example.test');
  assert.deepEqual(events.at(-1), ['auth-email', 'auth-id', 'new@example.test']);
  prisma.user.update = async () => { throw new Error('DB failure'); };
  await assert.rejects(() => service.update('auth-id', { email: 'retry@example.test' }, actor), /DB failure/);
  assert.deepEqual(events.at(-1), ['auth-email', 'auth-id', 'new@example.test']);
});

test('Auth adapter uses server-side creation and paginated lookup for legacy internal IDs', async (t) => {
  const calls = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/legacy')) return Response.json({ code: 'user_not_found' }, { status: 404 });
    if (url.includes('?page=1')) return Response.json({ users: Array.from({ length: 100 }, (_, index) => ({ id: `other-${index}`, email: `other-${index}@example.test` })) });
    if (url.includes('?page=2')) return Response.json({ users: [{ id: 'auth-id', email: payload.email }] });
    return Response.json({ id: 'auth-id' });
  });
  const accounts = new UserAccountsService({ getOrThrow: (key) => key === 'supabase.url' ? 'https://auth.example.test' : 'server-test-key' });
  assert.equal(await accounts.create(payload.email, payload.password, payload.fullName), 'auth-id');
  assert.equal(JSON.parse(calls[0].options.body).email_confirm, true);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(await accounts.find('legacy', payload.email), 'auth-id');
  await accounts.updateEmail('auth-id', 'new@example.test');
  assert.equal(calls.at(-1).options.method, 'PUT');
  assert.equal(JSON.parse(calls.at(-1).options.body).email, 'new@example.test');
});
