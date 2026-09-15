// Build first with npm run build, then run: node --test test/reports-teacher-access.test.cjs
require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { CoursesController } = require('../dist/src/courses/courses.controller');
const { CoursesService } = require('../dist/src/courses/courses.service');
const { ROLES_KEY } = require('../dist/src/common/decorators/roles.decorator');
const { SchoolYearsController } = require('../dist/src/school-years/school-years.controller');
const { StudentsController } = require('../dist/src/students/students.controller');
const { StudentsService } = require('../dist/src/students/students.service');

const teacher = {
  id: 'user-1',
  role: 'TEACHER',
  schoolId: 'school-1',
  teacherId: 'teacher-1',
};

test('teacher can read the data sources required by the reports screen', () => {
  for (const handler of [
    CoursesController.prototype.findAll,
    StudentsController.prototype.findAll,
    SchoolYearsController.prototype.findAll,
  ]) {
    const roles = Reflect.getMetadata(ROLES_KEY, handler);
    assert.ok(roles.includes('TEACHER'));
  }
});

test('course listing exposes only courses where the teacher is titular', async () => {
  let query;
  const prisma = {
    course: {
      findMany: async (value) => {
        query = value;
        return [];
      },
    },
  };
  const service = new CoursesService(prisma, {}, {});

  await service.findAll(teacher);

  assert.deepEqual(query.where, {
    schoolId: 'school-1',
    titularId: 'teacher-1',
  });
});

test('student listing exposes only students from titular courses', async () => {
  let query;
  const prisma = {
    student: {
      findMany: async (value) => {
        query = value;
        return [];
      },
    },
  };
  const service = new StudentsService(prisma, {}, {});

  await service.findAll(teacher);

  assert.deepEqual(query.where, {
    schoolId: 'school-1',
    course: { titularId: 'teacher-1' },
  });
});

test('unlinked teacher cannot receive courses or students by omitting a filter', async () => {
  const queries = [];
  const prisma = {
    course: { findMany: async (query) => queries.push(query) && [] },
    student: { findMany: async (query) => queries.push(query) && [] },
  };
  const unlinkedTeacher = { ...teacher, teacherId: null };

  await new CoursesService(prisma, {}, {}).findAll(unlinkedTeacher);
  await new StudentsService(prisma, {}, {}).findAll(unlinkedTeacher);

  assert.equal(queries[0].where.titularId, '');
  assert.equal(queries[1].where.course.titularId, '');
});
