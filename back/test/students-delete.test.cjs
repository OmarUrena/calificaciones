// npm run build && node --test test/students-delete.test.cjs
// Uses an isolated transactional store. No real student or database is modified.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { Reflector } = require('@nestjs/core');
const { StudentsController } = require('../dist/src/students/students.controller');
const { StudentsService } = require('../dist/src/students/students.service');
const { AuditService } = require('../dist/src/audit/audit.service');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');
const { RolesGuard } = require('../dist/src/common/guards/roles.guard');

const admin = { id: 'admin', role: 'ADMIN', schoolId: 'school-a' };
const dependencies = ['academicGrade', 'academicSubjectResult', 'technicalGrade', 'technicalSubjectResult'];

function fixture({ failAt, empty = false } = {}) {
  const student = { id: 'student-a', schoolId: 'school-a', schoolYearId: 'year-a', courseId: 'course-a',
    listNumber: 1, firstName: 'Ana', lastName: 'Pérez' };
  let state = {
    student: [student, { ...student, id: 'student-b', listNumber: 2 },
      { ...student, id: 'student-c', schoolId: 'school-b' }],
    auditLog: [],
    ...Object.fromEntries(dependencies.map((model) => [model, [
      ...(!empty ? [
        { id: `${model}-a`, studentId: 'student-a', schoolId: 'school-a', schoolYearId: 'year-a' },
        { id: `${model}-history`, studentId: 'student-a', schoolId: 'school-a', schoolYearId: 'historical-year' },
      ] : []),
      { id: `${model}-b`, studentId: 'student-b', schoolId: 'school-a' },
      { id: `${model}-c`, studentId: 'student-c', schoolId: 'school-b' },
    ]])),
  };
  let transactions = 0;
  const calls = [];
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const prisma = {
    student: { findUnique: async ({ where }) => state.student.find((row) => row.id === where.id) ?? null },
    $transaction: async (operation) => {
      transactions++;
      const draft = structuredClone(state);
      const tx = Object.fromEntries(dependencies.map((model) => [model, {
        deleteMany: async ({ where }) => {
          assert.ok(where.schoolId && where.studentId, 'Every deletion must be scoped to a school and student');
          calls.push(model);
          if (failAt === model) throw new Error(`failed ${model}`);
          const count = draft[model].filter((row) => matches(row, where)).length;
          draft[model] = draft[model].filter((row) => !matches(row, where));
          return { count };
        },
      }]));
      tx.student = { delete: async ({ where }) => {
        calls.push('student');
        if (failAt === 'student') throw new Error('failed student');
        const row = draft.student.find((item) => matches(item, where));
        assert.ok(row, 'Student deletion must retain its school scope');
        assert.ok(dependencies.every((model) => !draft[model].some((item) => item.studentId === row.id)),
          'Foreign-key dependencies must be removed before deleting the student');
        draft.student = draft.student.filter((item) => item.id !== row.id);
        return row;
      } };
      tx.auditLog = { create: async ({ data }) => {
        calls.push('auditLog');
        if (failAt === 'auditLog') throw new Error('failed auditLog');
        draft.auditLog.push(data);
        return data;
      } };
      const result = await operation(tx);
      state = draft;
      return result;
    },
  };
  const permissions = new PermissionsService(prisma);
  const service = new StudentsService(prisma, permissions, new AuditService(prisma, permissions));
  return { service, calls, state: () => structuredClone(state), transactions: () => transactions };
}

test('hard delete removes the student, all grades and results across years, and audits atomically', async () => {
  const { service, state, calls, transactions } = fixture();
  const before = state();
  const result = await service.remove('student-a', admin);
  assert.equal(result.id, 'student-a');
  assert.equal(transactions(), 1);
  assert.deepEqual(calls, [...dependencies, 'student', 'auditLog']);
  assert.deepEqual(state().student, before.student.filter((row) => row.id !== 'student-a'));
  for (const model of dependencies) {
    assert.deepEqual(state()[model], before[model].filter((row) => row.studentId !== 'student-a'));
  }
  assert.equal(state().auditLog.length, 1);
  assert.equal(state().auditLog[0].entity, 'Student');
  assert.equal(state().auditLog[0].entityId, 'student-a');
  assert.equal(state().auditLog[0].action, 'DELETE');
  assert.equal(state().auditLog[0].userId, admin.id);
  assert.equal(state().auditLog[0].schoolId, admin.schoolId);
  await assert.rejects(() => service.findOne('student-a', admin), (error) => error.getStatus() === 404);
});

test('students without grades can also be deleted', async () => {
  const { service, state } = fixture({ empty: true });
  await service.remove('student-a', admin);
  assert.equal(state().student.some((row) => row.id === 'student-a'), false);
});

for (const failAt of [...dependencies, 'student', 'auditLog']) {
  test(`failure in ${failAt} rolls back all grades, the student and the audit`, async () => {
    const { service, state } = fixture({ failAt });
    const before = state();
    await assert.rejects(() => service.remove('student-a', admin), /failed/);
    assert.deepEqual(state(), before);
  });
}

test('teachers, other schools and nonexistent students cannot trigger any deletion', async () => {
  const { service, transactions, state } = fixture();
  const before = state();
  await assert.rejects(() => service.remove('student-a', { ...admin, role: 'TEACHER' }), (error) => error.getStatus() === 403);
  await assert.rejects(() => service.remove('student-c', admin), (error) => error.getStatus() === 403);
  await assert.rejects(() => service.remove('student-a', { ...admin, schoolId: null }), (error) => error.getStatus() === 403);
  await assert.rejects(() => service.remove('missing', admin), (error) => error.getStatus() === 404);
  assert.equal(transactions(), 0);
  assert.deepEqual(state(), before);
});

test('HTTP deletion enforces administrative roles and school boundaries, including superadmin access', async () => {
  const { service, state } = fixture();
  const module = await Test.createTestingModule({
    controllers: [StudentsController], providers: [{ provide: StudentsService, useValue: service }],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalGuards(new RolesGuard(new Reflector()));
  app.use((request, response, next) => {
    request.user = { ...admin, role: request.headers['x-test-role'] ?? 'ADMIN' };
    next();
  });
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const remove = (id, role = 'ADMIN') => fetch(`${origin}/api/students/${id}`, {
      method: 'DELETE', headers: { 'x-test-role': role },
    });
    assert.equal((await remove('student-a', 'TEACHER')).status, 403);
    assert.equal((await remove('student-c')).status, 403);
    assert.equal((await remove('missing')).status, 404);
    assert.equal(state().student.length, 3);
    const response = await remove('student-a');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, 'student-a');
    assert.equal((await remove('student-a')).status, 404);
    assert.equal((await remove('student-c', 'SUPER_ADMIN')).status, 200);
    assert.deepEqual(state().student.map((row) => row.id), ['student-b']);
  } finally {
    await app.close();
  }
});
