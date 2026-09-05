// Build the backend first with npm run build, then run node --test test/imports.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Workbook } = require('exceljs');
const { ImportsService } = require('../dist/src/imports/imports.service');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');

const user = { id: 'admin', schoolId: 'school', role: 'ADMIN' };
const selection = { schoolYearId: 'year', courseId: 'course', subjectId: 'subject' };

function fixture() {
  const writes = [];
  const prisma = {
    course: { findFirst: async ({ where }) => where.id === 'course' ? { id: 'course', schoolId: 'school', schoolYearId: 'year' } : null },
    teacherAssignment: { findFirst: async ({ where }) => where.teacherId && where.teacherId !== 'teacher' ? null : { subject: { id: 'subject', name: 'Matemática' } } },
    technicalLearningOutcome: { findMany: async () => [{ id: 'ra-a', code: 'RA1', order: 1 }, { id: 'ra-b', code: 'RA3', order: 2 }] },
    student: {
      findMany: async () => [{ listNumber: 1 }, { listNumber: 8 }],
      findFirst: async () => ({ id: 'student' }),
      create: async ({ data }) => { writes.push(data); return data; },
    },
    subject: { findFirst: async ({ where }) => ({ id: where.name === 'Otra' ? 'other-subject' : 'subject' }) },
    academicGrade: { findUnique: async () => null },
    importJob: {
      create: async () => ({ id: 'job' }),
      update: async ({ data }) => ({ id: 'job', ...data }),
    },
  };
  const academic = { create: async (data) => { writes.push(data); } };
  const service = new ImportsService(prisma, new PermissionsService(prisma), academic, {}, { logImport: async () => {} });
  return { service, prisma, writes };
}

async function excel(rows) {
  const workbook = new Workbook();
  workbook.addWorksheet('Datos').addRows(rows);
  return { originalname: 'datos.xlsx', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
}

test('academic template has all 37 import columns and actual list numbers', async () => {
  const { service } = fixture();
  const buffer = await service.generateTemplate({ ...selection, type: 'academic' }, user);
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.columnCount, 37);
  assert.equal(sheet.getCell('C1').value, 'B1_P1');
  assert.equal(sheet.getRow(1).getCell(34).value, 'B4_RP4');
  assert.equal(sheet.getRow(1).getCell(37).value, 'CE');
  assert.equal(sheet.getCell('A3').value, 8);
  assert.equal(sheet.getCell('B3').value, 'Matemática');
  assert.equal(sheet.getCell('C3').value, null);
});

test('technical template uses actual RA codes, including nonconsecutive codes', async () => {
  const { service } = fixture();
  const workbook = new Workbook();
  await workbook.xlsx.load(await service.generateTemplate({ ...selection, type: 'technical' }, user));
  assert.deepEqual(workbook.worksheets[0].getRow(1).values.slice(1),
    ['numero_lista', 'modulo', 'RA1', 'RA1_R1', 'RA1_R2', 'RA1_ESP', 'RA3', 'RA3_R1', 'RA3_R2', 'RA3_ESP']);
});

for (const count of [1, 4, 8, 12]) {
  test(`technical template with ${count} RA can be filled and imported without losing columns`, async () => {
    const { service, prisma } = fixture();
    const outcomes = Array.from({ length: count }, (_, index) => ({
      id: `outcome-${index}`, code: `RA${index * 2 + 1}`, order: index + 1,
    }));
    prisma.technicalLearningOutcome.findMany = async (query) => {
      assert.deepEqual(query.where, { schoolId: 'school', subjectId: 'subject', isActive: true });
      assert.deepEqual(query.orderBy, { order: 'asc' });
      return outcomes;
    };
    prisma.technicalGrade = { findUnique: async () => null };
    const saved = [];
    const specials = [];
    service.technicalGradesService = {
      create: async (dto) => {
        saved.push(dto);
        return { grade: { id: dto.learningOutcomeId } };
      },
      update: async (id, dto) => { specials.push({ id, ...dto }); },
    };
    const workbook = new Workbook();
    await workbook.xlsx.load(await service.generateTemplate({ ...selection, type: 'technical' }, user));
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.columnCount, 2 + count * 4);
    // Keep one student and fill all four attempts for every configured RA.
    sheet.spliceRows(3, 1);
    outcomes.forEach((outcome, index) => {
      const column = 3 + index * 4;
      assert.deepEqual([0, 1, 2, 3].map((offset) => sheet.getRow(1).getCell(column + offset).value),
        [outcome.code, `${outcome.code}_R1`, `${outcome.code}_R2`, `${outcome.code}_ESP`]);
      [1, 2, 3, 4].forEach((score, offset) => { sheet.getRow(2).getCell(column + offset).value = score; });
    });
    const result = await service.importTechnicalGrades({
      originalname: 'plantilla-completada.xlsx',
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    }, selection, user);
    assert.equal(result.successRows, 1);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(saved.map((dto) => [dto.learningOutcomeId, dto.ordinaryScore, dto.recovery1Score, dto.recovery2Score]),
      outcomes.map((outcome) => [outcome.id, 1, 2, 3]));
    assert.deepEqual(specials, outcomes.map((outcome) => ({ id: outcome.id, specialScore: 4 })));
  });
}

test('technical templates reflect RA configuration changes on each download', async () => {
  const { service, prisma } = fixture();
  let outcomes = [{ id: 'ra1', code: 'RA1', order: 1 }];
  prisma.technicalLearningOutcome.findMany = async () => outcomes;
  const first = new Workbook();
  await first.xlsx.load(await service.generateTemplate({ ...selection, type: 'technical' }, user));
  assert.equal(first.worksheets[0].columnCount, 6);
  outcomes = [{ id: 'ra2', code: 'RA2', order: 1 }, { id: 'ra5', code: 'RA5', order: 2 }];
  const second = new Workbook();
  await second.xlsx.load(await service.generateTemplate({ ...selection, type: 'technical' }, user));
  assert.deepEqual(second.worksheets[0].getRow(1).values.slice(1),
    ['numero_lista', 'modulo', 'RA2', 'RA2_R1', 'RA2_R2', 'RA2_ESP', 'RA5', 'RA5_R1', 'RA5_R2', 'RA5_ESP']);
  outcomes = [];
  await assert.rejects(() => service.generateTemplate({ ...selection, type: 'technical' }, user), /no tiene RA activos/);
});

test('student template matches importer columns', async () => {
  const { service } = fixture();
  const workbook = new Workbook();
  await workbook.xlsx.load(await service.generateTemplate({ ...selection, type: 'students' }, user));
  assert.deepEqual(workbook.worksheets[0].getRow(1).values.slice(1), ['numero_lista', 'nombres', 'apellidos', 'curso']);
});

test('templates enforce school and teacher permissions before exposing student list numbers', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.generateTemplate({ ...selection, type: 'academic' }, { ...user, schoolId: 'other' }), /another school/);
  await assert.rejects(() => service.generateTemplate({ ...selection, type: 'students' }, { ...user, role: 'TEACHER' }), /administración/);
  await assert.rejects(() => service.generateTemplate({ ...selection, type: 'academic' }, { ...user, role: 'TEACHER', teacherId: 'not-assigned' }), /not assigned/);
  await service.generateTemplate({ ...selection, type: 'academic' }, { ...user, role: 'TEACHER', teacherId: 'teacher' });
});

test('selected subject and course reject mismatched Excel rows without writing them', async () => {
  const { service, prisma, writes } = fixture();
  const result = await service.importAcademicGrades(await excel([
    ['numero_lista', 'asignatura', 'B1_P1'], [1, 'Otra', 80],
  ]), selection, user);
  assert.equal(result.errorRows, 1);
  assert.match(result.errors[0], /Fila 2:.*no coincide/);
  assert.equal(writes.length, 0);

  prisma.course.findFirst = async ({ where }) => {
    if (where.OR) return where.id === 'course' ? null : { id: 'another-course' };
    return { id: 'course', schoolId: 'school', schoolYearId: 'year' };
  };
  const students = await service.importStudents(await excel([
    ['numero_lista', 'nombres', 'apellidos', 'curso'], [1, 'Ana', 'Pérez', 'another-course'],
  ]), selection, user);
  assert.equal(students.errorRows, 1);
  assert.equal(writes.length, 0);
});

test('valid grades and row errors produce an accurate partial summary with Excel row numbers', async () => {
  const { service, writes } = fixture();
  const summary = await service.importAcademicGrades(await excel([
    ['numero_lista', 'asignatura', 'B1_P1'],
    [1, 'Matemática', 80], [], [8, 'Matemática', 'no numérico'],
  ]), selection, user);
  assert.equal(summary.totalRows, 2);
  assert.equal(summary.successRows, 1);
  assert.equal(summary.errorRows, 1);
  assert.equal(summary.status, 'COMPLETED');
  assert.match(summary.errors[0], /^Fila 4:/);
  assert.equal(writes[0].p1, 80);
});

test('empty and corrupt workbooks return actionable validation errors', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.importAcademicGrades({ originalname: 'bad.xlsx', buffer: Buffer.from('broken') }, selection, user), /No se pudo leer/);
  const empty = await excel([['numero_lista', 'asignatura']]);
  await assert.rejects(() => service.importAcademicGrades(empty, selection, user), /no contiene filas/);
});
