// Build first, then node --test test/subject-grade-reports.test.cjs.
// Database reads and audit writes are simulated; Chromium renders a real PDF.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { Reflector } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { ReportsService } = require('../dist/src/reports/reports.service');
const { ReportsController } = require('../dist/src/reports/reports.controller');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');
const { RolesGuard } = require('../dist/src/common/guards/roles.guard');
const { buildSubjectGradeReportHtml } = require('../dist/src/reports/subject-grade-report');
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const { resolve } = require('node:path');

const teacher = { id: 'user', role: 'TEACHER', schoolId: 'school', teacherId: 'teacher' };
const scope = { schoolId: 'school', schoolYearId: 'year', courseId: 'course', subjectId: 'subject' };

function fixture(type = 'ACADEMIC', overrides = {}) {
  const queries = [];
  const audit = [];
  const rendered = [];
  const assignment = {
    id: 'assignment', ...scope, teacherId: 'teacher', isActive: true,
    school: { name: 'Escuela de prueba' }, schoolYear: { name: '2026-2027' },
    course: { name: '5to. A', titularId: 'another-teacher' }, subject: { name: 'Matemáticas', type },
    teacher: { name: 'Docente de prueba' }, ...overrides,
  };
  const students = [
    { id: 'a', listNumber: 1, firstName: 'Ana', lastName: 'Pérez' },
    { id: 'b', listNumber: 2, firstName: 'Luis', lastName: 'Rodríguez' },
  ];
  const grades = [1, 2, 3, 4].map((blockNumber) => ({ ...scope, studentId: 'a', blockNumber,
    p1: 11, rp1: 12, p2: 22, rp2: 23, p3: 33, rp3: 34, p4: 44, rp4: 45 }));
  grades.push({ ...scope, studentId: 'b', blockNumber: 1, p2: 0 });
  const record = (name, result) => async (query) => { queries.push({ name, query }); return result; };
  const prisma = {
    teacherAssignment: { findFirst: async (query) => {
      queries.push({ name: 'assignment', query });
      return Object.entries(query.where).every(([key, value]) => assignment[key] === value) ? assignment : null;
    } },
    student: { findMany: record('students', students) },
    academicGrade: { findMany: record('academic', grades) },
    technicalGrade: { findMany: record('technical', [{ ...scope, studentId: 'a', learningOutcomeId: 'ra1',
      ordinaryScore: 0, recovery1Score: 5, recovery2Score: 6, specialScore: 7, validScore: 7 }]) },
    technicalLearningOutcome: { findMany: record('outcomes', [
      { id: 'ra1', code: 'RA1', name: 'Resultado activo', weight: 50, isActive: true },
      { id: 'ra2', code: 'RA2', name: 'Resultado histórico', weight: 50, isActive: false },
    ]) },
  };
  const service = new ReportsService(prisma, new PermissionsService(prisma), { log: async (entry) => audit.push(entry) }, { get: () => undefined });
  service.renderPdf = async (html) => { rendered.push(html); return Buffer.from('%PDF-mock'); };
  return { service, queries, audit, rendered, assignment, students };
}

test('a non-titular teacher can export their own subject for every academic period', async () => {
  for (const period of [1, 2, 3, 4]) {
    const { service, queries, audit, rendered } = fixture();
    const report = await service.generateSubjectGradeReport('assignment', period, teacher);
    assert.equal(report.filename, `calificaciones-5to-A-Matematicas-P${period}.pdf`);
    assert.equal(report.buffer.toString(), '%PDF-mock');
    assert.match(rendered[0], new RegExp(`<th>P${period}</th><th>RP${period}</th>`));
    for (const other of [1, 2, 3, 4].filter((value) => value !== period)) {
      assert.doesNotMatch(rendered[0], new RegExp(`<th>(?:P|RP)${other}</th>`));
    }
    assert.match(rendered[0], /Ana Pérez/);
    assert.match(rendered[0], /Luis Rodríguez/);
    assert.deepEqual(queries[0].query.where, { id: 'assignment', isActive: true, schoolId: 'school', teacherId: 'teacher' });
    assert.deepEqual(queries.find((entry) => entry.name === 'academic').query.where, scope);
    assert.deepEqual(queries.find((entry) => entry.name === 'students').query.where,
      { schoolId: 'school', schoolYearId: 'year', courseId: 'course' });
    assert.equal(queries.some((entry) => entry.name === 'technical'), false);
    assert.equal(audit[0].action, 'GENERATE_REPORT');
    assert.equal(audit[0].newValue.period, period);
  }
});

test('zero scores are preserved and missing scores remain distinguishable', async () => {
  const { service, rendered } = fixture();
  await service.generateSubjectGradeReport('assignment', 2, teacher);
  assert.match(rendered[0], /<td>0<\/td>/);
  assert.match(rendered[0], /<td class="recovery">—<\/td>/);
  assert.match(rendered[0], /<td>22<\/td>/);
  assert.doesNotMatch(rendered[0], /<td>11<\/td>|<td>33<\/td>|<td>44<\/td>/);
});

test('multiple selected periods include only those periods and reject empty or ambiguous choices', async () => {
  const { service, rendered, audit } = fixture();
  const report = await service.generateSubjectGradeReport('assignment', undefined, teacher, { periods: [3, 1] });
  assert.equal(report.filename, 'calificaciones-5to-A-Matematicas-P1-P3.pdf');
  assert.match(rendered[0], /<th>P1<\/th>/);
  assert.match(rendered[0], /<th>P3<\/th>/);
  assert.doesNotMatch(rendered[0], /<th>(?:P|RP)[24]<\/th>/);
  assert.deepEqual(audit[0].newValue.periods, [1, 3]);
  for (const selection of [{ periods: [] }, { periods: [1, 1] }, { periods: [5] }, { periods: [1.5] }, { periods: [1], outcomeIds: ['ra1'] }]) {
    await assert.rejects(() => service.generateSubjectGradeReport('assignment', undefined, teacher, selection), (error) => error.getStatus() === 400);
  }
  await assert.rejects(() => service.generateSubjectGradeReport('assignment', 1, teacher, { periods: [2] }), (error) => error.getStatus() === 400);
});

test('RA options and exports are assignment-scoped and never include an unselected RA', async () => {
  const { service, rendered, queries, audit } = fixture('TECHNICAL');
  const options = await service.subjectGradeReportOptions('assignment', teacher);
  assert.deepEqual(options.outcomes.map((outcome) => outcome.id), ['ra1', 'ra2']);
  const report = await service.generateSubjectGradeReport('assignment', undefined, teacher, { outcomeIds: ['ra2'] });
  assert.equal(report.filename, 'calificaciones-5to-A-Matematicas-RA2.pdf');
  assert.match(rendered[0], /RA2/);
  assert.doesNotMatch(rendered[0], /RA1/);
  assert.deepEqual(queries.find((entry) => entry.name === 'technical').query.where, { ...scope, learningOutcomeId: { in: ['ra2'] } });
  assert.deepEqual(audit[0].newValue.outcomeIds, ['ra2']);
  for (const outcomeIds of [[], ['not-this-subject'], ['ra1', 'ra1']]) {
    await assert.rejects(() => service.generateSubjectGradeReport('assignment', undefined, teacher, { outcomeIds }), (error) => error.getStatus() === 400);
  }
  await assert.rejects(() => service.subjectGradeReportOptions('assignment', { ...teacher, teacherId: 'other-teacher' }), (error) => error.getStatus() === 404);
});

test('unlinked, different-school, different-teacher and inactive assignments stop before reading grades', async () => {
  for (const [actor, overrides, status] of [
    [{ ...teacher, teacherId: null }, {}, 403],
    [{ ...teacher, schoolId: 'other-school' }, {}, 404],
    [{ ...teacher, teacherId: 'other-teacher' }, {}, 404],
    [teacher, { isActive: false }, 404],
  ]) {
    const { service, queries, audit, rendered } = fixture('ACADEMIC', overrides);
    await assert.rejects(() => service.generateSubjectGradeReport('assignment', 1, actor), (error) => error.getStatus() === status);
    assert.equal(queries.some((entry) => entry.name !== 'assignment'), false);
    assert.equal(audit.length, 0);
    assert.equal(rendered.length, 0);
  }
});

test('academic periods are required and bounded before any grade reads', async () => {
  for (const period of [undefined, 0, 5, 1.5, NaN]) {
    const { service, queries } = fixture();
    await assert.rejects(() => service.generateSubjectGradeReport('assignment', period, teacher), (error) => error.getStatus() === 400);
    assert.deepEqual(queries.map((entry) => entry.name), ['assignment']);
  }
});

test('technical exports include all attempts, inactive RA with stored grades and no invented periods', async () => {
  const { service, queries, rendered, audit } = fixture('TECHNICAL');
  const report = await service.generateSubjectGradeReport('assignment', undefined, teacher);
  assert.equal(report.filename, 'calificaciones-5to-A-Matematicas-por-RA.pdf');
  assert.match(rendered[0], /RA1|RA2/);
  assert.match(rendered[0], /Resultado histórico/);
  assert.match(rendered[0], /<th>O<\/th><th>R1<\/th><th>R2<\/th><th>ESP<\/th><th>V<\/th>/);
  assert.match(rendered[0], /<td>0<\/td><td>5<\/td><td>6<\/td><td>7<\/td><td>7<\/td>/);
  assert.doesNotMatch(rendered[0], /Período P/);
  assert.deepEqual(queries.find((entry) => entry.name === 'technical').query.where, scope);
  assert.deepEqual(queries.find((entry) => entry.name === 'outcomes').query.where,
    { schoolId: 'school', subjectId: 'subject', OR: [{ isActive: true }, { technicalGrades: { some: scope } }] });
  assert.equal(audit[0].newValue.period, null);
  assert.equal(queries.some((entry) => entry.name === 'academic'), false);
  await assert.rejects(() => service.generateSubjectGradeReport('assignment', 1, teacher), (error) => error.getStatus() === 400);
});

test('HTML safely escapes identities and paginates long rosters and fourteen RA without losing data', () => {
  const students = Array.from({ length: 41 }, (_, index) => ({ id: `s${index}`, listNumber: index + 1, firstName: `Estudiante ${index + 1}`, lastName: 'de prueba' }));
  const outcomes = Array.from({ length: 14 }, (_, index) => ({ id: `ra${index}`, code: `RA${index + 1}`, name: `Resultado ${index + 1}`, weight: 10 }));
  const html = buildSubjectGradeReportHtml({ school: '<script>Escuela</script>', schoolYear: '2026-2027', course: '5to A',
    subject: 'Matemática & lógica', teacher: '<img src=x>', students, type: 'TECHNICAL', grades: [], outcomes });
  assert.equal((html.match(/<section class="page">/g) ?? []).length, 8);
  assert.match(html, /&lt;script&gt;Escuela&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|<img src=x>/);
  assert.match(html, /Matemática &amp; lógica/);
  assert.match(html, /Estudiante 41 de prueba/);
  assert.match(html, /RA14/);
});

test('empty rosters and modules produce readable PDFs instead of empty files', async () => {
  const html = buildSubjectGradeReportHtml({ school: 'Escuela', schoolYear: '2026-2027', course: '5to A', subject: 'Módulo', teacher: 'Docente',
    students: [], type: 'TECHNICAL', grades: [], outcomes: [] });
  assert.match(html, /No hay RA registrados/);
  const renderer = new ReportsService({}, {}, {}, { get: () => undefined });
  const pdf = await renderer.renderPdf(html, false);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.subarray(-100).toString(), /%%EOF/);
});

test('populated academic and technical tables fit the printable width and render real PDFs', async () => {
  const students = Array.from({ length: 30 }, (_, index) => ({ id: `student-${index}`, listNumber: index + 1,
    firstName: `Estudiante ${index + 1}`, lastName: 'de prueba' }));
  const identity = { school: 'Centro educativo de prueba', schoolYear: '2026-2027', course: '5to A', subject: 'Matemática', teacher: 'Docente de prueba', students };
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 740, height: 980 } });
    await page.emulateMedia({ media: 'print' });
    for (const type of ['ACADEMIC', 'TECHNICAL']) {
      const data = type === 'ACADEMIC'
        ? { ...identity, type, periods: [1, 2, 3, 4], grades: [], blockTitles: ['Comunicativa', 'Pensamiento lógico, creativo y crítico', 'Científica y tecnológica', 'Ética y ciudadanía'] }
        : { ...identity, type, grades: [], outcomes: Array.from({ length: 14 }, (_, index) => ({ id: `ra-${index}`, code: `RA${index + 1}`,
          name: `Resultado de aprendizaje ${index + 1}`, weight: 10 })) };
      data.grades = type === 'ACADEMIC'
        ? students.flatMap((student) => [1, 2, 3, 4].map((blockNumber) => ({ studentId: student.id, blockNumber,
          p1: 85.94, rp1: null, p2: 90, rp2: null, p3: 79, rp3: null, p4: 100, rp4: null })))
        : students.flatMap((student) => data.outcomes.map((outcome) => ({ studentId: student.id, learningOutcomeId: outcome.id,
          ordinaryScore: 8, recovery1Score: null, recovery2Score: null, specialScore: null, validScore: 8 })));
      await page.setContent(buildSubjectGradeReportHtml(data));
      assert.equal(await page.locator('tbody tr').count(), type === 'ACADEMIC' ? 60 : 120);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('table')].every((table) => table.getBoundingClientRect().right <= 741)), true);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.score-column')].every((column) => column.getBoundingClientRect().width <= 27)), true);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('tbody td:not(.student)')].every((cell) => {
        const range = document.createRange(); range.selectNodeContents(cell); return range.getClientRects().length <= 1;
      })), true, 'Numeric values must remain on one line in the compact cells');
      const pdf = await page.pdf({ format: 'Letter', landscape: false, printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert.match(pdf.toString('latin1'), /\/MediaBox\s*\[0 0 612 792\]/);
      assert.ok(pdf.length > 10000);
      if (type === 'TECHNICAL') {
        const cache = resolve(__dirname, '../node_modules/.cache');
        mkdirSync(cache, { recursive: true });
        await page.screenshot({ path: resolve(cache, 'subject-grade-report-preview.png'), clip: { x: 0, y: 0, width: 740, height: 980 } });
      }
    }
  } finally { await browser.close(); }
});

test('HTTP subject-grade route downloads PDF bytes and validates optional periods', async () => {
  const calls = [];
  const pdf = Buffer.from('%PDF-test-subject');
  const module = await Test.createTestingModule({ controllers: [ReportsController], providers: [{ provide: ReportsService, useValue: {
    generateSubjectGradeReport: async (...args) => {
      calls.push(args);
      return { buffer: pdf, filename: 'calificaciones-5to-A-Matematicas-P2.pdf' };
    },
  } }] }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalGuards(new RolesGuard(new Reflector()));
  app.use((request, response, next) => { request.user = teacher; next(); });
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const response = await fetch(`${origin}/api/reports/assignments/assignment/grades?period=2`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/pdf/);
    assert.match(response.headers.get('content-disposition'), /Matematicas-P2.pdf/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
    assert.deepEqual(calls[0].slice(0, 3), ['assignment', 2, teacher]);
    for (const value of ['0', '5', '1.5', 'abc']) {
      assert.equal((await fetch(`${origin}/api/reports/assignments/assignment/grades?period=${value}`)).status, 400);
    }
    assert.equal((await fetch(`${origin}/api/reports/assignments/assignment/grades`)).status, 200);
    assert.equal(calls[1][1], undefined);
    assert.equal(calls.length, 2);
    assert.equal((await fetch(`${origin}/api/reports/assignments/assignment/grades?periods=1&periods=3`)).status, 200);
    assert.deepEqual(calls.at(-1)[3].periods, [1, 3]);
    assert.equal((await fetch(`${origin}/api/reports/assignments/assignment/grades?outcomeIds=ra1&outcomeIds=ra2`)).status, 200);
    assert.deepEqual(calls.at(-1)[3].outcomeIds, ['ra1', 'ra2']);
    for (const query of ['periods=1&periods=1', 'periods=1.5', 'periods=5', 'outcomeIds=', 'outcomeIds=ra1&outcomeIds=ra1']) {
      assert.equal((await fetch(`${origin}/api/reports/assignments/assignment/grades?${query}`)).status, 400);
    }
  } finally { await app.close(); }
});
