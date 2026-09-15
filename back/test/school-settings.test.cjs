// npm run build, then node --test test/school-settings.test.cjs (no real DB/storage writes).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { Reflector } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { SchoolsController } = require('../dist/src/schools/schools.controller');
const { SchoolsService } = require('../dist/src/schools/schools.service');
const { SchoolLogoStorageService } = require('../dist/src/schools/school-logo-storage.service');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');
const { RolesGuard } = require('../dist/src/common/guards/roles.guard');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEAAAAABJRU5ErkJggg==', 'base64');
const file = { buffer: png, mimetype: 'image/png' };
const configuration = {
  'supabase.url': 'https://storage.example.test',
  'supabase.serviceRoleKey': 'test-service-key',
  'supabase.schoolLogosBucket': 'school-logos',
};
const storage = () => new SchoolLogoStorageService({ getOrThrow: (key) => configuration[key] });

test('logo storage uploads with school-specific paths and returns a public URL', async (t) => {
  const requests = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    requests.push({ url, options });
    return Response.json(options.method === 'POST' ? { Key: 'uploaded' } : { public: true });
  });
  const url = await storage().upload('school-a', file);
  assert.match(url, /^https:\/\/storage.example.test\/storage\/v1\/object\/public\/school-logos\/school-a\/[\w-]+\.png$/);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.headers['Content-Type'], 'image/png');
  assert.equal(requests[1].options.headers['x-upsert'], 'false');
  assert.deepEqual(Buffer.from(requests[1].options.body), png);
});

test('missing logo bucket is created with only the supported image formats and 2 MB limit', async (t) => {
  const requests = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) return Response.json({ statusCode: '404' }, { status: 400 });
    return Response.json({ public: true });
  });
  await storage().upload('school-a', file);
  const bucket = JSON.parse(requests[1].options.body);
  assert.equal(bucket.public, true);
  assert.equal(bucket.file_size_limit, 2 * 1024 * 1024);
  assert.deepEqual(bucket.allowed_mime_types, ['image/png', 'image/jpeg', 'image/webp']);
  assert.equal(requests.length, 4);
});

test('invalid, spoofed and oversized logos are rejected before contacting storage', async (t) => {
  const network = t.mock.method(global, 'fetch', async () => { throw new Error('Unexpected request'); });
  for (const invalid of [undefined, { buffer: Buffer.alloc(0), mimetype: 'image/png' },
    { buffer: Buffer.from('<svg>not PNG</svg>'), mimetype: 'image/png' },
    { buffer: png, mimetype: 'image/svg+xml' },
    { buffer: Buffer.alloc(2 * 1024 * 1024 + 1), mimetype: 'image/png' }]) {
    await assert.rejects(() => storage().upload('school-a', invalid), (error) => error.getStatus() === 400);
  }
  assert.equal(network.mock.callCount(), 0);
});

test('private bucket and storage failures return clear errors without publishing a URL', async (t) => {
  const network = t.mock.method(global, 'fetch', async () => Response.json({ public: false }));
  await assert.rejects(() => storage().upload('school-a', file), /no permite mostrar imágenes/);
  network.mock.mockImplementation(async () => { throw new Error('private internal details'); });
  await assert.rejects(() => storage().upload('school-a', file), (error) => error.getStatus() === 503 && !error.message.includes('private internal'));
});

test('HTTP settings and logo routes enforce roles and school boundaries, persist changes and audit them', async () => {
  const schools = {
    'school-a': { id: 'school-a', name: 'Escuela A', code: 'A', address: 'Anterior', phone: '123', logoUrl: null, isActive: true },
    'school-b': { id: 'school-b', name: 'Escuela B', code: 'B', isActive: true },
  };
  const audit = [];
  const uploads = [];
  const prisma = { school: {
    findUnique: async ({ where }) => schools[where.id] ?? null,
    update: async ({ where, data }) => (schools[where.id] = { ...schools[where.id], ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) }),
  } };
  const service = new SchoolsService(prisma, new PermissionsService(prisma), { logUpdate: async (entry) => audit.push(entry) }, {
    upload: async (schoolId, uploaded) => {
      uploads.push(schoolId);
      assert.deepEqual(uploaded.buffer, png);
      return `https://storage.example.test/${schoolId}/logo.png`;
    },
  });
  const module = await Test.createTestingModule({
    controllers: [SchoolsController], providers: [{ provide: SchoolsService, useValue: service }],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalGuards(new RolesGuard(new Reflector()));
  app.use((request, response, next) => {
    request.user = { id: 'user', schoolId: 'school-a', role: request.headers['x-test-role'] ?? 'ADMIN' };
    next();
  });
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const body = () => {
      const form = new FormData();
      form.append('file', new Blob([png], { type: 'image/png' }), 'logo.png');
      return form;
    };
    for (const role of ['TEACHER', 'ADMIN']) {
      const id = role === 'TEACHER' ? 'school-a' : 'school-b';
      for (const request of [
        { path: `/schools/${id}`, options: {} },
        { path: `/schools/${id}`, options: { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'No permitido' }) } },
        { path: `/schools/${id}/logo`, options: { method: 'POST', body: body() } },
      ]) {
        const result = await fetch(`${origin}/api${request.path}`, { ...request.options, headers: { ...request.options.headers, 'x-test-role': role } });
        assert.equal(result.status, 403);
      }
    }
    assert.deepEqual(uploads, []);
    const saved = await fetch(`${origin}/api/schools/school-a`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nuevo nombre', code: 'A2', address: '', phone: '' }),
    });
    assert.equal(saved.status, 200);
    const data = await saved.json();
    assert.equal(data.name, 'Nuevo nombre');
    assert.equal(data.address, '');
    assert.equal(data.phone, '');
    const uploaded = await fetch(`${origin}/api/schools/school-a/logo`, { method: 'POST', body: body() });
    assert.equal(uploaded.status, 201);
    assert.equal((await uploaded.json()).logoUrl, 'https://storage.example.test/school-a/logo.png');
    assert.equal(schools['school-a'].name, 'Nuevo nombre');
    assert.equal(audit.length, 2);
    assert.equal(audit[1].oldValue.logoUrl, null);
    assert.equal(audit[1].newValue.logoUrl, schools['school-a'].logoUrl);
    assert.equal((await fetch(`${origin}/api/schools/school-b/logo`, { method: 'POST', body: body(), headers: { 'x-test-role': 'SUPER_ADMIN' } })).status, 201);
  } finally { await app.close(); }
});
