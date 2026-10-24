// Build first: npm run build. No database writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');

const {
  UpdateTeacherAssignmentDto,
} = require('../dist/src/teacher-assignments/dto/update-teacher-assignment.dto');
const {
  TeacherAssignmentsService,
} = require('../dist/src/teacher-assignments/teacher-assignments.service');

const ids = {
  assignment: '11111111-1111-4111-8111-111111111111',
  school: '22222222-2222-4222-8222-222222222222',
  oldYear: '33333333-3333-4333-8333-333333333333',
  newYear: '44444444-4444-4444-8444-444444444444',
  oldTeacher: '55555555-5555-4555-8555-555555555555',
  newTeacher: '66666666-6666-4666-8666-666666666666',
  subject: '77777777-7777-4777-8777-777777777777',
  oldCourse: '88888888-8888-4888-8888-888888888888',
  newCourse: '99999999-9999-4999-8999-999999999999',
  user: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

const actor = {
  id: ids.user,
  email: 'admin@example.test',
  fullName: 'Administrador',
  role: 'ADMIN',
  schoolId: ids.school,
  teacherId: null,
  isActive: true,
};

function relationModel() {
  return { findFirst: async () => ({ id: 'found' }) };
}

test('the update DTO accepts schoolYearId', async () => {
  const dto = plainToInstance(UpdateTeacherAssignmentDto, {
    schoolYearId: ids.newYear,
    teacherId: ids.newTeacher,
  });

  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

  assert.deepEqual(errors, []);
});

test('updating an assignment validates and saves the new school year', async () => {
  const current = {
    id: ids.assignment,
    schoolId: ids.school,
    schoolYearId: ids.oldYear,
    teacherId: ids.oldTeacher,
    subjectId: ids.subject,
    courseId: ids.oldCourse,
    isActive: true,
  };
  const courseQueries = [];
  const updates = [];
  const prisma = {
    teacherAssignment: {
      findUnique: async () => current,
      findFirst: async () => null,
      update: async ({ data }) => {
        updates.push(data);
        return { ...current, ...data };
      },
    },
    schoolYear: relationModel(),
    teacher: relationModel(),
    subject: relationModel(),
    course: {
      findFirst: async (query) => {
        courseQueries.push(query);
        return { id: ids.newCourse };
      },
    },
  };
  const service = new TeacherAssignmentsService(
    prisma,
    { ensureCanAccessSchool: () => undefined },
    { logUpdate: async () => undefined },
  );

  const result = await service.update(
    ids.assignment,
    {
      schoolYearId: ids.newYear,
      courseId: ids.newCourse,
      teacherId: ids.newTeacher,
    },
    actor,
  );

  assert.equal(courseQueries[0].where.schoolYearId, ids.newYear);
  assert.equal(courseQueries[0].where.id, ids.newCourse);
  assert.equal(updates[0].schoolYearId, ids.newYear);
  assert.equal(result.teacherId, ids.newTeacher);
});

test('creating over an inactive assignment returns a useful conflict', async () => {
  let created = false;
  const prisma = {
    teacherAssignment: {
      findFirst: async () => ({ isActive: false }),
      create: async () => {
        created = true;
      },
    },
    schoolYear: relationModel(),
    teacher: relationModel(),
    subject: relationModel(),
    course: relationModel(),
  };
  const service = new TeacherAssignmentsService(
    prisma,
    { ensureCanAccessSchool: () => undefined },
    {},
  );

  await assert.rejects(
    () =>
      service.create(
        {
          schoolId: ids.school,
          schoolYearId: ids.newYear,
          teacherId: ids.newTeacher,
          subjectId: ids.subject,
          courseId: ids.newCourse,
          isActive: true,
        },
        actor,
      ),
    /Ya existe una asignación inactiva.*Reactívala/,
  );
  assert.equal(created, false);
});
