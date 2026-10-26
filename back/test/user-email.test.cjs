// Build the backend first. All account requests are simulated.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { CreateUserDto } = require('../dist/src/users/dto/create-user.dto');
const { UpdateUserDto } = require('../dist/src/users/dto/update-user.dto');
const { LoginDto } = require('../dist/src/auth/dto/login.dto');
const { isUserEmail } = require('../dist/src/common/decorators/is-user-email.decorator');
const { UserAccountsService } = require('../dist/src/users/user-accounts.service');
const { AuthService } = require('../dist/src/auth/auth.service');

const email = 'angelica.bonillame1.@docente.edu.do';
const frontPath = path.resolve(__dirname, '../../front/lib/user-email.ts');
const frontModule = { exports: {} };
const compiled = ts.transpileModule(readFileSync(frontPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('require', 'module', 'exports', compiled)(createRequire(frontPath), frontModule, frontModule.exports);
const { userEmailSchema } = frontModule.exports;

test('frontend and all user DTOs preserve the institutional address including its final dot', () => {
  for (const input of [email, '  ANGELICA.BONILLAME1.@DOCENTE.EDU.DO  ']) {
    assert.equal(userEmailSchema.parse(input), email);
    for (const Dto of [CreateUserDto, UpdateUserDto, LoginDto]) {
      const dto = plainToInstance(Dto, { email: input });
      assert.equal(dto.email, email);
      assert.deepEqual(validateSync(dto).filter((error) => error.property === 'email'), []);
    }
  }
  assert.equal(isUserEmail(email), true);
  for (const ordinary of ['angelica.bonillame1@docente.edu.do', 'teacher+tag@example.com']) {
    assert.equal(userEmailSchema.parse(ordinary), ordinary);
    assert.equal(isUserEmail(ordinary), true);
  }
});

test('the institutional exception keeps malformed addresses and other domains blocked', () => {
  for (const invalid of [
    '', 'angelica', '.angelica@docente.edu.do', 'angelica..bonilla.@docente.edu.do',
    'angelica..@docente.edu.do', 'angelica.@example.com', 'angelica.@docente.edu.do.evil.com',
    'angel ica.@docente.edu.do', 'angelica@@docente.edu.do', 'angelica.@docente',
    'angelica\n.@docente.edu.do', `${'a'.repeat(64)}.@docente.edu.do`,
  ]) {
    assert.equal(userEmailSchema.safeParse(invalid).success, false, invalid);
    assert.equal(isUserEmail(invalid), false, invalid);
    for (const Dto of [CreateUserDto, UpdateUserDto, LoginDto]) {
      assert.equal(validateSync(plainToInstance(Dto, { email: invalid })).some((error) => error.property === 'email'), true, invalid);
    }
  }
  for (const value of [undefined, null, 123, {}, []]) assert.equal(isUserEmail(value), false);
});

test('account creation, email updates and password verification send the complete address to Auth', async (t) => {
  const calls = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: JSON.parse(options.body) });
    return Response.json({ id: 'account-id' });
  });
  const config = { getOrThrow: (key) => key === 'supabase.url' ? 'https://auth.example.test' : 'test-key' };
  const accounts = new UserAccountsService(config);
  await accounts.create(email, 'Example123!', 'Angélica Bonilla');
  await accounts.updateEmail('account-id', email);
  await new AuthService(config, {}).verifyPassword(email, 'Example123!');
  assert.equal(calls.length, 3);
  for (const call of calls) assert.equal(call.body.email, email);
  assert.equal(calls[0].body.email_confirm, true);
  assert.equal(calls[2].url, 'https://auth.example.test/auth/v1/token?grant_type=password');
});

test('HTTP user creation and editing accept the exact address and reject malformed variants', async () => {
  const { Test } = require('@nestjs/testing');
  const { ValidationPipe } = require('@nestjs/common');
  const { UsersController } = require('../dist/src/users/users.controller');
  const { UsersService } = require('../dist/src/users/users.service');
  const writes = [];
  const service = {
    create: async (dto) => { writes.push(dto); return { id: 'user', ...dto }; },
    update: async (id, dto) => { writes.push(dto); return { id, ...dto }; },
  };
  const module = await Test.createTestingModule({ controllers: [UsersController], providers: [{ provide: UsersService, useValue: service }] }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  try {
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const request = (route, method, body) => fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await request('/users', 'POST', { email, fullName: 'Angélica Bonilla', role: 'SUPER_ADMIN' })).status, 201);
    assert.equal((await request('/users/user', 'PATCH', { email })).status, 200);
    assert.deepEqual(writes.map((dto) => dto.email), [email, email]);
    assert.equal((await request('/users/user', 'PATCH', { email: 'angelica..@docente.edu.do' })).status, 400);
    assert.equal(writes.length, 2);
  } finally { await app.close(); }
});
