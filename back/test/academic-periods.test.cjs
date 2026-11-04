// npm run build && node --test test/academic-periods.test.cjs
// HTTP, grade persistence and Excel imports use an isolated in-memory database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { Reflector } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { Prisma } = require('@prisma/client');
const { Workbook } = require('exceljs');
const { SchoolYearsController } = require('../dist/src/school-years/school-years.controller');
const { SchoolYearsService } = require('../dist/src/school-years/school-years.service');
const { AcademicGradesService } = require('../dist/src/academic-grades/academic-grades.service');
const { ImportsService } = require('../dist/src/imports/imports.service');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');
const { RolesGuard } = require('../dist/src/common/guards/roles.guard');

const admin = { id: 'admin', schoolId: 'school', role: 'ADMIN' };
const context = { schoolId: 'school', schoolYearId: 'year', courseId: 'course', studentId: 'student', subjectId: 'subject' };
const scoreFields = ['p1', 'rp1', 'p2', 'rp2', 'p3', 'rp3', 'p4', 'rp4'];

function fixture() {
  let year = { id: 'year', schoolId: 'school', name: '2026-2027', isActive: true,
    p1Enabled: false, rp1Enabled: false, p2Enabled: true, rp2Enabled: true,
    p3Enabled: true, rp3Enabled: true, p4Enabled: true, rp4Enabled: true };
  const grade = { id: 'grade', ...context, blockNumber: 1,
    ...Object.fromEntries(scoreFields.map((field) => [field, null])),
    p1: new Prisma.Decimal('60.00'), rp1: new Prisma.Decimal('75.00'), pc: null };
  const writes = [];
  const audit = [];
  const course = { id: 'course', schoolId: 'school', schoolYearId: 'year', name: '4to A' };
  const prisma = {
    schoolYear: {
      findUnique: async ({ where }) => where.id === 'year' ? year : { ...year, id: where.id, schoolId: 'other' },
      findFirst: async ({ where }) => where.id === year.id && where.schoolId === year.schoolId ? year : null,
      findMany: async () => [year],
      update: async ({ data }) => (year = { ...year, ...Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      ) }),
    },
    course: { findUnique: async () => course, findFirst: async () => course },
    subject: { findFirst: async () => ({ id: 'subject' }), findUnique: async () => ({ id: 'subject', name: 'Matemática' }) },
    teacherAssignment: { findFirst: async () => ({ id: 'assignment', subject: { id: 'subject', name: 'Matemática' } }) },
    student: { findFirst: async () => ({ id: 'student' }), findMany: async () => [{ id: 'student', listNumber: 1 }] },
    academicGrade: {
      findUnique: async ({ where }) => where.id ? grade : null,
      findMany: async () => [grade],
      update: async ({ data }) => { writes.push(data); return { ...grade, ...data }; },
      create: async ({ data }) => { writes.push(data); return { id: 'created', ...data }; },
    },
    academicSubjectResult: { findMany: async () => [], findUnique: async () => null, upsert: async ({ create }) => create },
    importJob: { create: async () => ({ id: 'job' }), update: async ({ data }) => ({ id: 'job', ...data }) },
  };
  const permissions = new PermissionsService(prisma);
  const auditService = { logCreate: async (entry) => audit.push(entry), logUpdate: async (entry) => audit.push(entry), logImport: async () => {} };
  const grades = new AcademicGradesService(prisma, permissions, auditService);
  return {
    grades, writes, audit, grade, prisma,
    years: new SchoolYearsService(prisma, permissions, auditService),
    imports: new ImportsService(prisma, permissions, grades, {}, auditService),
  };
}

test('closed periods reject changing and clearing ordinary/recovery scores for every role', async () => {
  const { grades, writes } = fixture();
  for (const role of ['ADMIN', 'SUPER_ADMIN', 'TEACHER']) {
    for (const scores of [{ p1: 65 }, { p1: null }, { rp1: 80 }, { rp1: null }]) {
      await assert.rejects(() => grades.update('grade', scores, { ...admin, role, teacherId: 'teacher' }),
        (error) => error.getStatus() === 403 && /P1 está desactivado/.test(error.message));
    }
  }
  assert.equal(writes.length, 0);
});

test('full-row saves preserve closed Decimal values while editing an open period', async () => {
  const { grades, writes } = fixture();
  const result = await grades.update('grade', { p1: 60, rp1: 75, p2: 82, rp2: null, p3: null, rp3: null }, admin);
  assert.equal(result.grade.p2, 82);
  assert.equal(Number(result.grade.p1), 60);
  assert.equal(Number(result.grade.rp1), 75);
  assert.equal(writes.length, 1);
});

test('create and bulk cannot populate a closed period; zero is a score', async () => {
  const { grades, writes } = fixture();
  for (const p1 of [0, 60]) {
    const dto = { ...context, blockNumber: 1, p1 };
    await assert.rejects(() => grades.create(dto, admin), (error) => error.getStatus() === 403);
    await assert.rejects(() => grades.bulk({ grades: [dto] }, admin), (error) => error.getStatus() === 403);
  }
  assert.equal(writes.length, 0);
  const result = await grades.create({ ...context, blockNumber: 1, p2: 85 }, admin);
  assert.equal(result.grade.p2, 85);
});

test('all four periods close independently and reopening permits editing again', async () => {
  const { grades, years, writes, grade } = fixture();
  for (const period of [1, 2, 3, 4]) {
    await years.update('year', { [`p${period}Enabled`]: false, [`rp${period}Enabled`]: false }, admin);
    for (const scores of [{ [`p${period}`]: 50 }, { [`rp${period}`]: 80 }]) {
      await assert.rejects(() => grades.update('grade', scores, admin), (error) => error.getStatus() === 403);
    }
  }
  assert.equal(writes.length, 0);
  assert.equal(Number(grade.p1), 60);
  await years.update('year', { p1Enabled: true }, admin);
  const result = await grades.update('grade', { p1: 65 }, admin);
  assert.equal(result.grade.p1, 65);
});

test('ordinary and recovery locks are independent and never erase a locked recovery', async () => {
  const { grades, years, writes, grade } = fixture();
  await years.update('year', { p1Enabled: false, rp1Enabled: true }, admin);
  assert.equal((await grades.update('grade', { rp1: 80 }, admin)).grade.rp1, 80);
  await assert.rejects(() => grades.update('grade', { p1: 65 }, admin), (error) => error.getStatus() === 403);
  await years.update('year', { p1Enabled: true, rp1Enabled: false }, admin);
  assert.equal((await grades.update('grade', { p1: 65 }, admin)).grade.p1, 65);
  await assert.rejects(() => grades.update('grade', { rp1: 80 }, admin), (error) => error.getStatus() === 403);
  await assert.rejects(() => grades.update('grade', { p1: 80, rp1: null }, admin), (error) => error.getStatus() === 403);
  await assert.rejects(() => grades.update('grade', { p1: 80 }, admin), (error) => error.getStatus() === 400);
  assert.equal(Number(grade.rp1), 75);
  assert.equal(writes.length, 2);
});

test('register includes period states and the lookup is scoped to the school and year', async () => {
  const { grades, prisma } = fixture();
  const register = await grades.findRegister('course', 'subject', admin);
  assert.equal(register.periods.p1Enabled, false);
  assert.equal(register.periods.p2Enabled, true);
  assert.equal(Number(register.grades[0].p1), 60);
  prisma.schoolYear.findFirst = async ({ where }) => {
    assert.deepEqual(where, { id: 'year', schoolId: 'school' });
    return null;
  };
  await assert.rejects(() => grades.update('grade', { p2: 80 }, admin), (error) => error.getStatus() === 404);
});

test('Excel import reports a closed period error without writing the protected grade', async () => {
  const { imports, writes } = fixture();
  const selection = { schoolYearId: 'year', courseId: 'course', subjectId: 'subject' };
  const workbook = new Workbook();
  await workbook.xlsx.load(await imports.generateTemplate({ ...selection, type: 'academic' }, admin));
  workbook.worksheets[0].getCell('B5').value = 60;
  const result = await imports.importAcademicGrades({
    originalname: 'notas.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  }, selection, admin);
  assert.equal(result.errorRows, 1);
  assert.match(JSON.stringify(result.errors), /P1 está desactivado/);
  assert.equal(writes.length, 0);
});

test('HTTP period updates enforce roles, school boundaries, boolean values and audit changes', async () => {
  const { years, audit } = fixture();
  const module = await Test.createTestingModule({
    controllers: [SchoolYearsController], providers: [{ provide: SchoolYearsService, useValue: years }],
  }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalGuards(new RolesGuard(new Reflector()));
  app.use((request, response, next) => {
    request.user = { ...admin, role: request.headers['x-test-role'] ?? 'ADMIN' };
    next();
  });
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const patch = (id, values, role = 'ADMIN') => fetch(`${origin}/school-years/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-test-role': role }, body: JSON.stringify(values),
    });
    assert.equal((await patch('year', { p1Enabled: true }, 'TEACHER')).status, 403);
    assert.equal((await patch('other-year', { p1Enabled: true })).status, 403);
    for (const field of ['p1Enabled', 'rp1Enabled', 'p2Enabled', 'rp2Enabled', 'p3Enabled', 'rp3Enabled', 'p4Enabled', 'rp4Enabled']) {
      for (const value of [null, 'false', 0, [], {}]) {
        assert.equal((await patch('year', { [field]: value })).status, 400);
      }
    }
    assert.equal(audit.length, 0);
    const saved = await patch('year', { p1Enabled: true, p3Enabled: false });
    assert.equal(saved.status, 200);
    const year = await saved.json();
    assert.equal(year.p1Enabled, true);
    assert.equal(year.rp1Enabled, false);
    assert.equal(year.p2Enabled, true);
    assert.equal(year.p3Enabled, false);
    assert.equal(year.p4Enabled, true);
    assert.equal(audit.length, 1);
    assert.equal(audit[0].oldValue.p1Enabled, false);
    assert.equal(audit[0].newValue.p1Enabled, true);
    assert.equal((await patch('year', { p4Enabled: false }, 'SUPER_ADMIN')).status, 200);
    // Regression: a deployed validator must accept both boolean values for every P and RP.
    for (const field of ['p1Enabled', 'rp1Enabled', 'p2Enabled', 'rp2Enabled', 'p3Enabled', 'rp3Enabled', 'p4Enabled', 'rp4Enabled']) {
      for (const value of [false, true]) {
        const response = await patch('year', { [field]: value });
        assert.equal(response.status, 200, `${field}=${value} must be accepted`);
        assert.equal((await response.json())[field], value);
      }
    }
  } finally {
    await app.close();
  }
});
