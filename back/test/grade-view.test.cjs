// Build first: npm run build. These tests do not connect to the database.
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RequestMethod } = require('@nestjs/common');
const { METHOD_METADATA } = require('@nestjs/common/constants');
const { GradeViewService } = require('../dist/src/grade-view/grade-view.service');
const { GradeViewController } = require('../dist/src/grade-view/grade-view.controller');
const { PermissionsService } = require('../dist/src/common/services/permissions.service');

const admin = { id: 'admin', role: 'ADMIN', schoolId: 'school-1', teacherId: null };
const teacher = { ...admin, role: 'TEACHER', teacherId: 'teacher-1' };
const course = { id: 'course-1', schoolId: 'school-1', schoolYearId: 'year-1' };
const subject = { id: 'subject-1', schoolId: 'school-1', type: 'ACADEMIC', isActive: false };
const academicGrade = (scores = {}) => ({
  subjectId: subject.id, studentId: 'student-1',
  p1: null, rp1: null, p2: null, rp2: null, p3: null, rp3: null, p4: null, rp4: null,
  ...scores,
});

function setup(options = {}) {
  const calls = [];
  const model = (name, rows = []) => ({
    findMany: async (query) => { calls.push({ name, query }); return rows; },
  });
  const prisma = {
    course: {
      ...model('courses', [course]),
      findFirst: async (query) => {
        calls.push({ name: 'course', query });
        return options.denied ? null : { ...course, ...options.course };
      },
    },
    subject: model('subjects', options.subjects ?? [subject]),
    student: model('students', options.students ?? [{ id: 'student-1', listNumber: 1 }]),
    teacherAssignment: model('assignments', [{ subjectId: subject.id, teacher: { name: 'Docente de la asignatura' } }]),
    academicGrade: model('academic-grades', options.academicGrades ?? [academicGrade({ p1: 0 })]),
    academicSubjectResult: model('academic-results'),
    technicalGrade: model('technical-grades', options.technicalGrades ?? []),
    technicalSubjectResult: model('technical-results'),
    technicalLearningOutcome: model('outcomes', options.outcomes ?? []),
  };
  return { calls, service: new GradeViewService(prisma, new PermissionsService(prisma)) };
}

test('the visualization controller exposes only GET routes', () => {
  for (const name of ['findCourses', 'findSubjects', 'findRegister']) {
    assert.equal(Reflect.getMetadata(METHOD_METADATA, GradeViewController.prototype[name]), RequestMethod.GET);
  }
});

test('admin can list every course in their school without active year or titular restrictions', async () => {
  const { service, calls } = setup();
  await service.findCourses(admin);
  assert.deepEqual(calls[0].query.where, { schoolId: 'school-1' });
});

test('teacher courses include titular courses even without a teaching assignment and stay in their school', async () => {
  const { service, calls } = setup();
  await service.findCourses(teacher);
  assert.deepEqual(calls[0].query.where, {
    schoolId: 'school-1',
    OR: [
      { titularId: 'teacher-1' },
      { teacherAssignments: { some: { teacherId: 'teacher-1', isActive: true } } },
    ],
  });
});

test('a teacher without a linked record cannot omit the teacher filter', async () => {
  const { service, calls } = setup();
  await service.findCourses({ ...teacher, teacherId: null });
  assert.equal(calls[0].query.where.OR[0].titularId, '');
  assert.equal(calls[0].query.where.OR[1].teacherAssignments.some.teacherId, '');
});

test('unavailable course stops access before reading subjects, students or grades', async () => {
  const { service, calls } = setup({ denied: true });
  await assert.rejects(service.findRegister('other-course', subject.id, teacher), /Curso no disponible/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].query.where.schoolId, teacher.schoolId);
  assert.equal(calls[0].query.where.OR[1].teacherAssignments.some.teacherId, teacher.teacherId);
});

test('cross school access is rejected even if an unexpected course is returned', async () => {
  const { service, calls } = setup();
  await assert.rejects(service.findRegister(course.id, subject.id, { ...admin, schoolId: 'school-2' }), /another school/);
  assert.equal(calls.length, 1);
});

test('teacher subject access uses the course year and an active personal assignment', async () => {
  const { service, calls } = setup({ subjects: [] });
  await assert.rejects(service.findRegister(course.id, subject.id, teacher), /Asignatura no disponible/);
  assert.deepEqual(calls.find((call) => call.name === 'subjects').query.where, {
    schoolId: course.schoolId,
    teacherAssignments: { some: {
      schoolId: course.schoolId, schoolYearId: course.schoolYearId,
      courseId: course.id, teacherId: teacher.teacherId, isActive: true,
    } },
  });
  assert.ok(!calls.some((call) => call.name === 'students' || call.name === 'academic-grades'));
});

test('admin can read historical inactive subjects, preserves zero scores and scopes every record query', async () => {
  const { service, calls } = setup();
  const register = await service.findRegister(course.id, subject.id, admin);
  assert.equal(register.type, 'ACADEMIC');
  assert.equal(register.subject.isActive, false);
  assert.equal(register.grades[0].p1, 0);
  const subjectWhere = calls.find((call) => call.name === 'subjects').query.where;
  assert.equal(subjectWhere.isActive, undefined);
  assert.ok(subjectWhere.OR.some((item) => item.academicGrades));
  for (const name of ['students', 'academic-grades', 'academic-results']) {
    const where = calls.find((call) => call.name === name).query.where;
    assert.equal(where.schoolId, course.schoolId);
    assert.equal(where.schoolYearId, course.schoolYearId);
    assert.equal(where.courseId, course.id);
  }
});

test('technical register includes inactive learning outcomes with saved grades', async () => {
  const { service, calls } = setup({ subjects: [{ ...subject, type: 'TECHNICAL' }] });
  const register = await service.findRegister(course.id, subject.id, admin);
  assert.equal(register.type, 'TECHNICAL');
  const where = calls.find((call) => call.name === 'outcomes').query.where;
  assert.equal(where.schoolId, course.schoolId);
  assert.equal(where.subjectId, subject.id);
  assert.deepEqual(where.OR[1], { technicalGrades: { some: {
    schoolId: course.schoolId, schoolYearId: course.schoolYearId,
    courseId: course.id, subjectId: subject.id,
  } } });
  assert.ok(!calls.some((call) => call.name === 'academic-grades'));
});

test('titular teacher can read another teacher subject without their own assignment', async () => {
  const { service, calls } = setup({ course: { titularId: teacher.teacherId } });
  const register = await service.findRegister(course.id, subject.id, teacher);
  assert.equal(register.subject.id, subject.id);
  assert.equal(register.grades[0].p1, 0);
  const where = calls.find((call) => call.name === 'subjects').query.where;
  assert.equal(where.teacherAssignments, undefined);
  assert.ok(where.OR.some((item) => item.teacherAssignments));
  assert.equal(where.schoolId, teacher.schoolId);
});

test('being titular does not give edit permission for another teacher subject', async () => {
  const permissions = new PermissionsService({ teacherAssignment: { findFirst: async () => null } });
  await assert.rejects(permissions.ensureTeacherCanManageSubject({
    user: teacher, schoolId: course.schoolId, schoolYearId: course.schoolYearId,
    courseId: course.id, subjectId: subject.id,
  }), /not assigned/);
});

test('unlinked teacher cannot use a course without titular as titular access', async () => {
  const { service, calls } = setup({ subjects: [], course: { titularId: null } });
  await assert.rejects(service.findRegister(course.id, subject.id, { ...teacher, teacherId: null }), /Asignatura no disponible/);
  const where = calls.find((call) => call.name === 'subjects').query.where;
  assert.equal(where.teacherAssignments.some.teacherId, '');
});

test('course overview counts zero and recovery grades, deduplicates blocks and ignores students outside roster', async () => {
  const { service, calls } = setup({
    course: { titularId: teacher.teacherId },
    students: [{ id: 'student-1' }, { id: 'student-2' }],
    academicGrades: [
      academicGrade({ p1: 0 }), academicGrade({ p1: 75 }), academicGrade({ rp2: 70 }),
      academicGrade({ studentId: 'student-2' }),
      academicGrade({ studentId: 'other-student', p3: 80 }),
    ],
  });
  const [overview] = await service.findSubjects(course.id, teacher);
  assert.deepEqual(overview.teachers, ['Docente de la asignatura']);
  assert.equal(overview.studentCount, 2);
  assert.equal(overview.studentsWithGrades, 1);
  assert.deepEqual(overview.progress, [
    { label: 'P1', studentsWithGrades: 1 }, { label: 'P2', studentsWithGrades: 1 },
    { label: 'P3', studentsWithGrades: 0 }, { label: 'P4', studentsWithGrades: 0 },
  ]);
  for (const name of ['assignments', 'academic-grades', 'technical-grades']) {
    const where = calls.find((call) => call.name === name).query.where;
    assert.equal(where.schoolId, course.schoolId);
    assert.equal(where.schoolYearId, course.schoolYearId);
    assert.equal(where.courseId, course.id);
    assert.deepEqual(where.subjectId, { in: [subject.id] });
  }
});

test('empty grade rows do not count as published grades', async () => {
  const { service } = setup({ academicGrades: [academicGrade()] });
  const [overview] = await service.findSubjects(course.id, admin);
  assert.equal(overview.studentsWithGrades, 0);
  assert.ok(overview.progress.every((item) => item.studentsWithGrades === 0));
});

test('technical overview reports each RA separately including zero recovery grades', async () => {
  const technicalSubject = { ...subject, type: 'TECHNICAL' };
  const { service } = setup({
    subjects: [technicalSubject],
    outcomes: [
      { id: 'ra-1', subjectId: subject.id, code: 'RA1' },
      { id: 'ra-2', subjectId: subject.id, code: 'RA2' },
    ],
    technicalGrades: [{
      subjectId: subject.id, studentId: 'student-1', learningOutcomeId: 'ra-1',
      ordinaryScore: null, recovery1Score: 0, recovery2Score: null, specialScore: null,
    }],
  });
  const [overview] = await service.findSubjects(course.id, admin);
  assert.equal(overview.studentsWithGrades, 1);
  assert.deepEqual(overview.progress, [
    { label: 'RA1', studentsWithGrades: 1 }, { label: 'RA2', studentsWithGrades: 0 },
  ]);
});
