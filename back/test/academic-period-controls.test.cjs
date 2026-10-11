// Run after npm run build. Uses in-memory collaborators; never touches the database.
require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AcademicPeriodControlsService } = require('../dist/src/academic-period-controls/academic-period-controls.service');
const { AcademicGradesService } = require('../dist/src/academic-grades/academic-grades.service');

const admin = { id: 'admin-1', role: 'ADMIN', schoolId: 'school-a' };
const teacher = { id: 'teacher-1', role: 'TEACHER', schoolId: 'school-a' };
const schoolYear = { id: 'year-a', schoolId: 'school-a' };
const key = { schoolId_schoolYearId: { schoolId: 'school-a', schoolYearId: 'year-a' } };

function setup(initial = null) {
  let row = initial;
  let updates = 0;
  const prisma = {
    schoolYear: { findUnique: async () => schoolYear },
    academicPeriodControl: {
      findUnique: async () => row,
      upsert: async ({ create, update }) => {
        updates++;
        row = { id: 'control-1', ...(row ?? create), ...update, updatedAt: new Date(), updatedBy: admin.id };
        return row;
      },
    },
    $queryRaw: async () => [{ id: schoolYear.id }],
    $transaction: async (callback) => callback(prisma),
  };
  const permissions = { ensureCanAccessSchool: (user, schoolId) => {
    if (user.schoolId !== schoolId) throw new Error('Wrong school');
  } };
  const logs = [];
  prisma.auditLog = { create: async ({ data }) => logs.push(data) };
  return { service: new AcademicPeriodControlsService(prisma, permissions), prisma, logs, get updates() { return updates; } };
}

test('all periods start open, and another school cannot read or change them', async () => {
  const { service } = setup();
  const controls = await service.findForYear('year-a', teacher);
  assert.deepEqual(Object.values(controls.fields), Array(8).fill(true));
  await assert.rejects(() => service.findForYear('year-a', { ...admin, schoolId: 'school-b' }), /Wrong school/);
  await assert.rejects(() => service.setOpen('year-a', 'p1', false, { ...admin, schoolId: 'school-b' }), /Wrong school/);
  await assert.rejects(() => service.setOpen('year-a', 'p1', false, teacher), (error) => error.getStatus() === 403);
});

test('closing P1 does not close RP1 or P2 and is audited once', async () => {
  const state = setup();
  const result = await state.service.setOpen('year-a', 'p1', false, admin);
  assert.equal(result.fields.p1, false);
  assert.equal(result.fields.rp1, true);
  assert.equal(result.fields.p2, true);
  assert.equal(state.logs.length, 1);
  assert.deepEqual(state.logs[0].newValue, { schoolYearId: 'year-a', field: 'p1', isOpen: false });
  await state.service.setOpen('year-a', 'p1', false, admin);
  assert.equal(state.updates, 1);
  assert.equal(state.logs.length, 1);
});

test('only changed scores are blocked, including clearing a score', async () => {
  const { service } = setup({ p1Open: false, rp1Open: true, p2Open: true });
  const current = { p1: '48.00', rp1: null, p2: '75.00' };
  await service.ensureFieldsOpen('school-a', 'year-a', { p1: 48, rp1: 55, p2: 80 }, current);
  await assert.rejects(
    () => service.ensureFieldsOpen('school-a', 'year-a', { p1: null }, current),
    (error) => error.getStatus() === 403 && /P1/.test(error.message),
  );
  await assert.rejects(
    () => service.ensureFieldsOpen('school-a', 'year-a', { p1: 49 }, current),
    (error) => error.getStatus() === 403,
  );
});

test('closed P1 is enforced across every competency block before writing a grade', async () => {
  const state = setup({ p1Open: false });
  let writes = 0;
  const gradePrisma = {
    student: { findFirst: async () => ({ id: 'student-1' }) },
    subject: { findFirst: async () => ({ id: 'subject-1' }) },
    teacherAssignment: { findFirst: async () => ({ id: 'assignment-1' }) },
    academicGrade: { create: async () => { writes++; } },
    $queryRaw: async () => [{ id: 'year-a' }],
    $transaction: async (callback) => callback(gradePrisma),
    academicPeriodControl: state.prisma.academicPeriodControl,
  };
  const gradeService = new AcademicGradesService(gradePrisma, {
    ensureCanAccessSchool() {},
  }, {}, state.service);
  for (const blockNumber of [1, 2, 3, 4]) {
    await assert.rejects(() => gradeService.create({
      schoolId: 'school-a', schoolYearId: 'year-a', courseId: 'course-1',
      studentId: 'student-1', subjectId: 'subject-1', blockNumber, p1: 50,
    }, admin), (error) => error.getStatus() === 403);
  }
  assert.equal(writes, 0);
});

test('editing an open field succeeds with an unchanged closed field, but changing the closed field fails', async () => {
  const state = setup({ p1Open: false, p2Open: true });
  const current = {
    id: 'grade-1', schoolId: 'school-a', schoolYearId: 'year-a', courseId: 'course-1',
    studentId: 'student-1', subjectId: 'subject-1', blockNumber: 3,
    p1: 50, rp1: null, p2: 60, rp2: null, p3: null, rp3: null, p4: null, rp4: null,
  };
  let writes = 0;
  const prisma = {
    subject: { findFirst: async () => ({ id: 'subject-1' }) },
    teacherAssignment: { findFirst: async () => ({ id: 'assignment-1' }) },
    academicPeriodControl: state.prisma.academicPeriodControl,
    academicGrade: {
      findUnique: async () => current,
      update: async ({ data }) => { writes++; return { ...current, ...data }; },
      findMany: async () => [],
    },
    academicSubjectResult: {
      findUnique: async () => null,
      upsert: async () => ({ id: 'result-1' }),
    },
    $queryRaw: async () => [{ id: 'year-a' }],
    $transaction: async (callback) => callback(prisma),
  };
  const service = new AcademicGradesService(prisma, { ensureCanAccessSchool() {} }, {
    logUpdate: async () => {},
  }, state.service);
  await service.update('grade-1', { p1: 50, p2: 70 }, admin);
  assert.equal(writes, 1);
  await assert.rejects(() => service.update('grade-1', { p1: 51, p2: 70 }, admin),
    (error) => error.getStatus() === 403);
  assert.equal(writes, 1);
});

test('Excel ignores closed and unchanged scores while saving open periods', async () => {
  const state = setup({ p1Open: false, p2Open: true });
  const writes = [];
  const audits = [];
  const grades = new Map([[1, {
    id: 'grade-1', schoolId: 'school-a', schoolYearId: 'year-a', courseId: 'course-1',
    studentId: 'student-1', subjectId: 'subject-1', blockNumber: 1,
    p1: 50, rp1: null, p2: 60, rp2: null, p3: null, rp3: null, p4: null, rp4: null,
  }]]);
  const prisma = {
    student: { findFirst: async () => ({ id: 'student-1' }) },
    subject: { findFirst: async () => ({ id: 'subject-1' }) },
    teacherAssignment: { findFirst: async () => ({ id: 'assignment-1' }) },
    academicGrade: {
      findUnique: async ({ where }) => grades.get(where.schoolId_schoolYearId_studentId_subjectId_blockNumber.blockNumber) ?? null,
      findMany: async () => [...grades.values()],
      update: async ({ where, data }) => {
        writes.push(data);
        const current = [...grades.values()].find((grade) => grade.id === where.id);
        const grade = { ...current, ...data };
        grades.set(grade.blockNumber, grade);
        return grade;
      },
      create: async ({ data }) => {
        writes.push(data);
        const grade = { id: 'grade-2', ...data };
        grades.set(grade.blockNumber, grade);
        return grade;
      },
    },
    academicSubjectResult: {
      findUnique: async () => null,
      upsert: async () => ({ id: 'result-1' }),
    },
    academicPeriodControl: state.prisma.academicPeriodControl,
    $queryRaw: async () => [{ id: 'year-a' }],
    $transaction: async (callback) => callback(prisma),
  };
  const service = new AcademicGradesService(prisma, { ensureCanAccessSchool() {} }, {
    logUpdate: async (entry) => audits.push(entry),
    logCreate: async (entry) => audits.push(entry),
  }, state.service);
  const base = {
    schoolId: 'school-a', schoolYearId: 'year-a', courseId: 'course-1',
    studentId: 'student-1', subjectId: 'subject-1',
  };
  await service.saveImportedBlocks([
    { ...base, blockNumber: 1, p1: 99, p2: 75 },
    { ...base, blockNumber: 2, p1: 55, p2: 80 },
  ], admin);
  assert.equal(writes.length, 2);
  assert.equal(grades.get(1).p1, 50);
  assert.equal(grades.get(1).p2, 75);
  assert.equal(grades.get(2).p1, undefined);
  assert.equal(grades.get(2).p2, 80);
  assert.equal(audits.length, 2);

  await service.saveImportedBlocks([
    { ...base, blockNumber: 1, p1: 100, p2: 75 },
    { ...base, blockNumber: 2, p1: 55, p2: 80 },
  ], admin);
  assert.equal(writes.length, 2);
  assert.equal(audits.length, 2);
});
