// Build first. Uses transactional in-memory persistence, never a live database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { Workbook } = require('exceljs');
const { AcademicGradesService } = require('../dist/src/academic-grades/academic-grades.service');
const { SchoolYearsService } = require('../dist/src/school-years/school-years.service');
const { ImportsService } = require('../dist/src/imports/imports.service');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');
const { AuditService } = require('../dist/src/audit/audit.service');

const user = { id: 'admin', role: 'ADMIN', schoolId: 'school' };
const context = { schoolId: 'school', schoolYearId: 'year', courseId: 'course', studentId: 'student', subjectId: 'subject' };
const fields = ['p1', 'rp1', 'p2', 'rp2', 'p3', 'rp3', 'p4', 'rp4'];
const block = (blockNumber, scores = {}) => ({ ...context, blockNumber, ...scores });

function fixture(initialGrades = []) {
  const state = {
    year: { id: 'year', schoolId: 'school', ...Object.fromEntries(fields.map((field) => [`${field}Enabled`, true])) },
    grades: initialGrades.map((dto) => ({ id: `grade-${dto.blockNumber}`, ...dto })),
    result: null, logs: [], writes: 0, recalculations: 0, failBlock: null, failAudit: false, beforeWrite: null, beforeYearWrite: null,
  };
  let queue = Promise.resolve();
  const matchesYear = ({ where }) => where.id === 'year' && (!where.schoolId || where.schoolId === 'school');
  const prisma = {
    schoolYear: { findUnique: async (args) => matchesYear(args) ? state.year : null },
    student: { findFirst: async ({ where }) => where.schoolId === 'school' && where.schoolYearId === 'year' && where.courseId === 'course' && (where.id === 'student' || where.listNumber === 1) ? { id: 'student' } : null },
    subject: { findFirst: async () => ({ id: 'subject' }) },
    teacherAssignment: { findFirst: async () => ({ id: 'assignment', subject: { id: 'subject', name: 'Matemática' } }) },
    course: { findFirst: async () => ({ id: 'course', name: '4to A', schoolId: 'school', schoolYearId: 'year' }) },
    academicGrade: { findUnique: async ({ where }) => state.grades.find((grade) => grade.id === where.id) },
    importJob: { create: async () => ({ id: 'job' }), update: async ({ data }) => ({ id: 'job', ...data }) },
  };
  prisma.$transaction = async (callback) => {
    const previous = queue;
    let release;
    queue = new Promise((resolve) => { release = resolve; });
    await previous;
    const snapshot = JSON.parse(JSON.stringify({ year: state.year, grades: state.grades, result: state.result, logs: state.logs, writes: state.writes, recalculations: state.recalculations }));
    let locked = false;
    const requireLock = () => assert.equal(locked, true, 'period reads and writes require the year lock');
    const writeGrade = async ({ where, data }) => {
      requireLock();
      if (state.beforeWrite) await state.beforeWrite();
      const previousGrade = where && state.grades.find((grade) => grade.id === where.id);
      const number = previousGrade?.blockNumber ?? data.blockNumber;
      if (state.failBlock === number) throw new Error('Simulated persistence failure');
      const grade = { ...previousGrade, id: `grade-${number}`, ...data };
      state.grades = state.grades.filter((item) => item.id !== grade.id).concat(grade);
      state.writes++;
      return grade;
    };
    const tx = {
      $queryRaw: async (parts, ...values) => {
        assert.match(parts.join('?'), /FOR UPDATE/);
        assert.deepEqual(values, ['year', 'school']);
        locked = true;
        return [{ id: 'year' }];
      },
      schoolYear: {
        findFirst: async (args) => { requireLock(); return matchesYear(args) ? state.year : null; },
        update: async ({ data }) => {
          requireLock();
          if (state.beforeYearWrite) await state.beforeYearWrite();
          state.year = { ...state.year, ...data };
          return state.year;
        },
      },
      academicGrade: {
        findUnique: async ({ where }) => {
          requireLock();
          return state.grades.find((grade) => where.id ? grade.id === where.id : grade.blockNumber === where.schoolId_schoolYearId_studentId_subjectId_blockNumber.blockNumber) ?? null;
        },
        findMany: async () => { requireLock(); return state.grades; },
        create: writeGrade, update: writeGrade,
      },
      academicSubjectResult: {
        findUnique: async () => { requireLock(); return state.result; },
        upsert: async ({ create, update }) => {
          requireLock(); state.recalculations++;
          state.result = state.result ? { ...state.result, ...update } : { id: 'result', ...create };
          return state.result;
        },
        update: async ({ data }) => { requireLock(); state.result = { ...state.result, ...data }; return state.result; },
      },
      auditLog: { create: async ({ data }) => { requireLock(); if (state.failAudit) throw new Error('Audit unavailable'); state.logs.push(data); return data; } },
    };
    try { return await callback(tx); }
    catch (error) { Object.assign(state, snapshot); throw error; }
    finally { release(); }
  };
  const permissions = new PermissionsService(prisma);
  const audit = new AuditService(prisma, permissions);
  // The import job's summary audit is outside the academic row transaction.
  audit.logImport = async () => {};
  const grades = new AcademicGradesService(prisma, permissions, audit);
  return { state, grades, years: new SchoolYearsService(prisma, permissions, audit), imports: new ImportsService(prisma, permissions, grades, {}, audit) };
}

test('cumulative rows ignore closed/unchanged/blank scores, preserve zero, and are idempotent', async () => {
  const { state, grades } = fixture([block(1, { p1: new Prisma.Decimal(60), rp1: 75, p2: 80 }), block(2, { p1: 50 })]);
  state.year.p1Enabled = false;
  await grades.saveImportedBlocks([block(1, { p1: 90, rp1: 75, p2: 80, p3: 0, p4: null }), block(2, { p1: 90, p2: 81 })], user);
  assert.equal(Number(state.grades.find((g) => g.blockNumber === 1).p1), 60);
  assert.equal(state.grades.find((g) => g.blockNumber === 1).rp1, 75);
  assert.equal(state.grades.find((g) => g.blockNumber === 1).p3, 0);
  assert.equal(state.grades.find((g) => g.blockNumber === 2).p1, 50);
  assert.equal(state.writes, 2);
  assert.equal(state.recalculations, 1);
  assert.equal(state.logs.length, 2);
  await grades.saveImportedBlocks([block(1, { p1: 90, rp1: 75, p2: 80, p3: 0 }), block(2, { p1: 90, p2: 81 })], user);
  assert.equal(state.writes, 2);
  assert.equal(state.recalculations, 1);
  assert.equal(state.logs.length, 2);
});

test('closed recovery stays intact and open recovery is validated against the persisted ordinary score', async () => {
  const { state, grades } = fixture([block(1, { p1: 60, rp1: 75 })]);
  state.year.p1Enabled = false;
  await grades.saveImportedBlocks([block(1, { p1: 95, rp1: 80 })], user);
  assert.equal(state.grades[0].rp1, 80);
  state.year.rp1Enabled = false;
  await grades.saveImportedBlocks([block(1, { rp1: 99, p2: 82 })], user);
  assert.equal(state.grades[0].rp1, 80);
  state.year.rp1Enabled = true;
  await assert.rejects(() => grades.saveImportedBlocks([block(1, { rp1: 55 })], user), /cannot be lower/);
});

test('invalid later blocks or database failures roll back the entire row and its audits', async () => {
  const { state, grades } = fixture();
  await assert.rejects(() => grades.saveImportedBlocks([block(1, { p1: 80 }), block(2, { p1: 80, rp1: 90 })], user), /below 70/);
  assert.equal(state.writes, 0);
  state.failBlock = 2;
  await assert.rejects(() => grades.saveImportedBlocks([block(1, { p1: 80 }), block(2, { p1: 80 })], user), /persistence failure/);
  assert.deepEqual(state.grades, []);
  assert.equal(state.result, null);
  assert.equal(state.logs.length, 0);
  assert.equal(state.writes, 0);
});

test('final-evaluation failure rolls back blocks; repeating a complete row performs no writes or audits', async () => {
  const { state, grades } = fixture();
  const rows = [1, 2, 3, 4].map((number) => block(number, { p1: 60, p2: 60, p3: 60, p4: 60 }));
  await assert.rejects(() => grades.saveImportedBlocks(rows, user, { ce: 50 }), /greater than 100/);
  assert.deepEqual(state.grades, []);
  assert.equal(state.logs.length, 0);
  await grades.saveImportedBlocks(rows, user, { cec: 80 });
  assert.equal(state.result.cf, 60);
  assert.equal(state.result.ccf, 70);
  assert.equal(state.result.status, 'APPROVED');
  assert.equal(state.logs.length, 5);
  await grades.saveImportedBlocks(rows, user, { cec: 80 });
  assert.equal(state.writes, 4);
  assert.equal(state.recalculations, 1);
  assert.equal(state.logs.length, 5);
});

test('audit failure rolls back the academic row and its calculated result', async () => {
  const { state, grades } = fixture();
  state.failAudit = true;
  await assert.rejects(() => grades.saveImportedBlocks([block(1, { p2: 85 })], user), /Audit unavailable/);
  assert.deepEqual(state.grades, []);
  assert.equal(state.result, null);
  assert.equal(state.writes, 0);
});

test('imports enforce school, student context, integer grades and unique blocks', async () => {
  const { state, grades } = fixture();
  for (const dtos of [[block(1), block(1)], [block(1), { ...block(2), studentId: 'other' }], [block(5)], [block(1, { p1: 80.5 })]]) {
    await assert.rejects(() => grades.saveImportedBlocks(dtos, user));
  }
  await assert.rejects(() => grades.saveImportedBlocks([block(1, { p1: 80 })], { ...user, schoolId: 'other' }), /another school/);
  assert.equal(state.writes, 0);
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('an import waiting behind a period close sees the closed state', async () => {
  const { state, grades, years } = fixture();
  const entered = deferred(); const release = deferred();
  state.beforeYearWrite = async () => { entered.resolve(); await release.promise; };
  const closing = years.update('year', { p1Enabled: false }, user);
  await entered.promise;
  const saving = grades.saveImportedBlocks([block(1, { p1: 80, p2: 85 })], user);
  release.resolve();
  await Promise.all([closing, saving]);
  assert.equal(state.grades[0].p1, undefined);
  assert.equal(state.grades[0].p2, 85);
});

test('period closing waits for an existing grade transaction; later manual edits are rejected', async () => {
  const { state, grades, years } = fixture();
  const entered = deferred(); const release = deferred();
  state.beforeWrite = async () => { entered.resolve(); await release.promise; };
  const saving = grades.create(block(1, { p1: 80 }), user);
  await entered.promise;
  const closing = years.update('year', { p1Enabled: false }, user);
  assert.equal(state.year.p1Enabled, true);
  release.resolve();
  await Promise.all([saving, closing]);
  assert.equal(state.grades[0].p1, 80);
  await assert.rejects(() => grades.update('grade-1', { p1: 85 }, user), (error) => error.getStatus() === 403);
});

test('Excel cumulative imports retain accurate row summaries when a later row fails', async () => {
  const { imports, state } = fixture();
  state.year.p1Enabled = false;
  const book = new Workbook();
  book.addWorksheet('Datos').addRows([
    ['numero_lista', 'asignatura', 'B1_P1', 'B1_P2', 'B2_P1', 'B2_P2', 'B2_RP2'],
    [1, 'Matemática', 60, 85, 50, 80],
    [1, 'Matemática', 60, 90, 50, 80, 90],
  ]);
  const summary = await imports.importAcademicGrades({ originalname: 'notas.xlsx', buffer: Buffer.from(await book.xlsx.writeBuffer()) }, context, user);
  assert.equal(summary.totalRows, 2);
  assert.equal(summary.successRows, 1);
  assert.equal(summary.errorRows, 1);
  assert.match(summary.errors[0], /^Fila 3:/);
  assert.equal(state.grades.find((g) => g.blockNumber === 1).p2, 85);
});
