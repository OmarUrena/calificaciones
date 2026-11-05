// npm run build && node --test test/integer-grades.test.cjs
// All persistence is simulated. No real grades are modified.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { Workbook } = require('exceljs');
const { AcademicGradesService } = require('../dist/src/academic-grades/academic-grades.service');
const { TechnicalGradesService } = require('../dist/src/technical-grades/technical-grades.service');
const { CreateAcademicGradeDto } = require('../dist/src/academic-grades/dto/create-academic-grade.dto');
const { UpdateAcademicGradeDto } = require('../dist/src/academic-grades/dto/update-academic-grade.dto');
const { AcademicFinalEvaluationDto } = require('../dist/src/academic-grades/dto/academic-final-evaluation.dto');
const { CreateTechnicalGradeDto } = require('../dist/src/technical-grades/dto/create-technical-grade.dto');
const { UpdateTechnicalGradeDto } = require('../dist/src/technical-grades/dto/update-technical-grade.dto');
const { ImportsService } = require('../dist/src/imports/imports.service');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');

const academicFields = ['p1', 'rp1', 'p2', 'rp2', 'p3', 'rp3', 'p4', 'rp4'];
const technicalFields = ['ordinaryScore', 'recovery1Score', 'recovery2Score', 'specialScore'];
const id = '10000000-0000-4000-8000-000000000001';
const context = { schoolId: id, schoolYearId: id, courseId: id, studentId: id, subjectId: id };
const user = { id, schoolId: id, role: 'ADMIN' };

for (const [Dto, fields, required] of [
  [CreateAcademicGradeDto, academicFields, { ...context, blockNumber: 1 }],
  [UpdateAcademicGradeDto, academicFields, {}],
  [CreateTechnicalGradeDto, technicalFields, { ...context, learningOutcomeId: id }],
  [UpdateTechnicalGradeDto, technicalFields, {}],
  [AcademicFinalEvaluationDto, ['cec', 'ceex', 'ce'], { studentId: id, subjectId: id }],
]) {
  test(`${Dto.name} accepts whole-valued decimals and rejects every fractional score`, async () => {
    for (const field of fields) {
      for (const value of [0, 75.0, 90.00, 100, null]) {
        assert.deepEqual(await validate(plainToInstance(Dto, { ...required, [field]: value })), [], `${field}=${value}`);
      }
      for (const value of [75.5, 89.99, 90.001, -1, NaN, Infinity, '90.0', true]) {
        const errors = await validate(plainToInstance(Dto, { ...required, [field]: value }));
        assert.ok(errors.some((error) => error.property === field), `${field}=${value} must be rejected`);
      }
    }
  });
}

function fixture() {
  const writes = [];
  const academicGrade = { id, ...context, blockNumber: 1,
    ...Object.fromEntries(academicFields.map((field) => [field, null])), p1: 60 };
  const technicalGrade = { id, ...context, learningOutcomeId: id,
    ...Object.fromEntries(technicalFields.map((field) => [field, null])), ordinaryScore: 30, validScore: 30 };
  const prisma = {
    student: { findFirst: async () => ({ id }), findMany: async () => [{ id, listNumber: 1 }] },
    course: { findFirst: async () => ({ id, schoolId: id, schoolYearId: id, name: '4to A' }) },
    subject: { findFirst: async () => ({ id, name: 'Asignatura' }) },
    teacherAssignment: { findFirst: async () => ({ id, subject: { id, name: 'Asignatura' } }) },
    schoolYear: { findFirst: async () => Object.fromEntries(academicFields.map((field) => [`${field}Enabled`, true])) },
    academicGrade: {
      findUnique: async () => academicGrade, findMany: async () => [],
      create: async ({ data }) => { writes.push(data); return { id, ...data }; },
      update: async ({ data }) => { writes.push(data); return { ...academicGrade, ...data }; },
    },
    academicSubjectResult: { findUnique: async () => null, upsert: async ({ create }) => create },
    technicalLearningOutcome: {
      findFirst: async () => ({ id, weight: 100 }),
      findMany: async () => [{ id, weight: 100, code: 'RA1', order: 1 }, { id: 'ra2', weight: 0, code: 'RA2', order: 2 }],
    },
    technicalGrade: {
      findUnique: async () => technicalGrade, findMany: async () => [technicalGrade],
      create: async ({ data }) => { writes.push(data); return { id, ...data }; },
      update: async ({ data }) => { writes.push(data); return { ...technicalGrade, ...data }; },
    },
    technicalSubjectResult: { upsert: async ({ create }) => create },
    importJob: { create: async () => ({ id }), update: async ({ data }) => ({ id, ...data }) },
  };
  prisma.$queryRaw = async () => [{ id }];
  prisma.$transaction = async (callback) => callback(prisma);
  const permissions = new PermissionsService(prisma);
  const audit = { logCreate: async () => {}, logUpdate: async () => {}, logImport: async () => {} };
  const academic = new AcademicGradesService(prisma, permissions, audit);
  const technical = new TechnicalGradesService(prisma, permissions, audit);
  return { writes, prisma, academic, technical, imports: new ImportsService(prisma, permissions, academic, technical, audit) };
}

test('service validation also protects internal academic create/update and final-evaluation calls', async () => {
  const { academic, writes } = fixture();
  for (const field of academicFields) {
    await assert.rejects(() => academic.create({ ...context, blockNumber: 1, [field]: 65.5 }, user), /entero/);
    await assert.rejects(() => academic.update(id, { [field]: 65.5 }, user), /entero/);
  }
  for (const field of ['cec', 'ceex', 'ce']) {
    await assert.rejects(() => academic.finalEvaluations({ studentId: id, subjectId: id, [field]: 65.5 }, user), /entero/);
  }
  assert.equal(writes.length, 0);
});

test('service validation protects every technical score against fractional and negative values', async () => {
  const { technical, writes } = fixture();
  for (const field of technicalFields) {
    for (const value of [65.5, -1, 101]) {
      await assert.rejects(() => technical.create({ ...context, learningOutcomeId: id, [field]: value }, user), /entero/);
      await assert.rejects(() => technical.update(id, { [field]: value }, user), /entero/);
    }
  }
  assert.equal(writes.length, 0);
});

test('whole-valued decimal grades keep their value and calculated PC can remain fractional', async () => {
  const { academic, technical } = fixture();
  const result = await academic.create({ ...context, blockNumber: 1, p1: 80.0, p2: 81, p3: 82, p4: 83 }, user);
  assert.equal(result.grade.pc, 81.5);
  assert.equal(result.grade.p1, 80);
  assert.equal((await technical.create({ ...context, learningOutcomeId: id, ordinaryScore: 90.0 }, user)).grade.ordinaryScore, 90);
});

test('academic Excel imports prevalidate every block and final evaluation before writing a row', async () => {
  const selection = { schoolYearId: id, courseId: id, subjectId: id };
  for (const column of ['B5', 'C5', 'AF5', 'AG5', 'AH5', 'AI5', 'AJ5']) {
    const { imports, writes } = fixture();
    const workbook = new Workbook();
    await workbook.xlsx.load(await imports.generateTemplate({ ...selection, type: 'academic' }, user));
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.getCell('B5').numFmt, '0');
    assert.equal(sheet.getCell('B5').dataValidation.type, 'whole');
    sheet.getCell('B5').value = 60;
    sheet.getCell(column).value = 65.5;
    const result = await imports.importAcademicGrades({ originalname: 'notas.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) }, selection, user);
    assert.equal(result.errorRows, 1);
    assert.match(JSON.stringify(result.errors), /entero/);
    assert.equal(writes.length, 0);
  }
});

test('technical Excel imports reject a fractional score in a later RA before writing earlier grades', async () => {
  const selection = { schoolYearId: id, courseId: id, subjectId: id };
  for (const column of ['F5', 'G5', 'H5', 'I5']) {
    const { imports, writes } = fixture();
    const workbook = new Workbook();
    await workbook.xlsx.load(await imports.generateTemplate({ ...selection, type: 'technical' }, user));
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.getCell('B5').dataValidation.type, 'whole');
    sheet.getCell('B5').value = 60;
    sheet.getCell(column).value = 7.5;
    const result = await imports.importTechnicalGrades({ originalname: 'notas.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) }, selection, user);
    assert.equal(result.errorRows, 1);
    assert.match(JSON.stringify(result.errors), /entero/);
    assert.equal(writes.length, 0);
  }
});
