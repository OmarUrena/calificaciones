// Build first: npm run build. No real account or database writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SchoolsService } = require('../dist/src/schools/schools.service');

const actor = {
  id: 'root',
  email: 'root@example.test',
  role: 'SUPER_ADMIN',
  schoolId: null,
};

test('permanent school deletion verifies the password and removes every dependent table', async () => {
  const calls = [];
  const modelNames = [
    'auditLog',
    'importJob',
    'academicGrade',
    'academicSubjectResult',
    'technicalGrade',
    'technicalSubjectResult',
    'teacherAssignment',
    'technicalLearningOutcome',
    'student',
    'course',
    'subject',
    'schoolYear',
    'user',
    'teacher',
  ];
  const tx = Object.fromEntries(
    modelNames.map((name) => [
      name,
      { deleteMany: async (args) => calls.push([name, args]) },
    ]),
  );
  tx.school = { delete: async (args) => calls.push(['school', args]) };
  const prisma = {
    school: { findUnique: async () => ({ id: 'school-a', name: 'Demo' }) },
    $transaction: async (operation) => operation(tx),
  };
  const verified = [];
  const service = new SchoolsService(
    prisma,
    { ensureCanAccessSchool: () => undefined },
    {},
    {},
    { verifyPassword: async (...args) => verified.push(args) },
  );

  const result = await service.remove('school-a', 'secret', actor);

  assert.deepEqual(verified, [['root@example.test', 'secret']]);
  assert.equal(calls.length, modelNames.length + 1);
  assert.deepEqual(calls.map(([name]) => name), [...modelNames, 'school']);
  assert.ok(calls.slice(0, -1).every(([, args]) => args.where.schoolId === 'school-a'));
  assert.deepEqual(result, { id: 'school-a', name: 'Demo', deleted: true });
});

test('a rejected password prevents all database deletions', async () => {
  let transactionStarted = false;
  const service = new SchoolsService(
    {
      school: { findUnique: async () => ({ id: 'school-a', name: 'Demo' }) },
      $transaction: async () => {
        transactionStarted = true;
      },
    },
    { ensureCanAccessSchool: () => undefined },
    {},
    {},
    { verifyPassword: async () => { throw new Error('invalid password'); } },
  );

  await assert.rejects(() => service.remove('school-a', 'wrong', actor), /invalid password/);
  assert.equal(transactionStarted, false);
});
