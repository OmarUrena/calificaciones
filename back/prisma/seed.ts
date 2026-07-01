import { AuditAction, PrismaClient, SubjectStatus, SubjectType, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const ids = {
  school: '11111111-1111-1111-1111-111111111111',
  schoolYear: '22222222-2222-2222-2222-222222222222',
  teacherTitular: '33333333-3333-3333-3333-333333333333',
  teacherAcademic: '33333333-3333-3333-3333-333333333334',
  teacherTechnical: '33333333-3333-3333-3333-333333333335',
  courseA: '44444444-4444-4444-4444-444444444444',
  courseB: '44444444-4444-4444-4444-444444444445',
  studentOne: '55555555-5555-5555-5555-555555555555',
  studentTwo: '55555555-5555-5555-5555-555555555556',
  studentThree: '55555555-5555-5555-5555-555555555557',
  superAdmin: '66666666-6666-6666-6666-666666666660',
  admin: '66666666-6666-6666-6666-666666666666',
  titularUser: '66666666-6666-6666-6666-666666666667',
  academicUser: '66666666-6666-6666-6666-666666666668',
  technicalUser: '66666666-6666-6666-6666-666666666669',
  spanish: '77777777-7777-7777-7777-777777777771',
  math: '77777777-7777-7777-7777-777777777772',
  biology: '77777777-7777-7777-7777-777777777773',
  webDesign: '77777777-7777-7777-7777-777777777781',
  database: '77777777-7777-7777-7777-777777777782',
};

const technicalOutcomeIds = {
  webRa1: '88888888-8888-8888-8888-888888888881',
  webRa2: '88888888-8888-8888-8888-888888888882',
  webRa3: '88888888-8888-8888-8888-888888888883',
  dbRa1: '88888888-8888-8888-8888-888888888891',
  dbRa2: '88888888-8888-8888-8888-888888888892',
};

async function main(): Promise<void> {
  await seedCoreData();
  await seedTeacherAssignments();
  await seedTechnicalLearningOutcomes();
  await seedAcademicGrades();
  await seedTechnicalGrades();
  await seedAuditLog();
}

async function seedCoreData(): Promise<void> {
  await prisma.school.upsert({
    where: { code: 'DEMO-001' },
    update: {
      name: 'Centro Educativo Demo',
      address: 'Direccion demo',
      phone: '809-000-0000',
      isActive: true,
    },
    create: {
      id: ids.school,
      name: 'Centro Educativo Demo',
      code: 'DEMO-001',
      address: 'Direccion demo',
      phone: '809-000-0000',
      isActive: true,
    },
  });

  await prisma.schoolYear.upsert({
    where: { schoolId_name: { schoolId: ids.school, name: '2025-2026' } },
    update: { isActive: true },
    create: {
      id: ids.schoolYear,
      schoolId: ids.school,
      name: '2025-2026',
      isActive: true,
    },
  });

  await Promise.all([
    upsertTeacher(ids.teacherTitular, 'Maestro Titular Demo'),
    upsertTeacher(ids.teacherAcademic, 'Docente Academico Demo'),
    upsertTeacher(ids.teacherTechnical, 'Docente Tecnico Demo'),
  ]);

  await prisma.course.upsert({
    where: { id: ids.courseA },
    update: {
      schoolId: ids.school,
      schoolYearId: ids.schoolYear,
      name: '4to A Informatica',
      grade: '4to',
      section: 'A',
      area: 'Informatica',
      modality: 'Tecnico Profesional',
      titularId: ids.teacherTitular,
    },
    create: {
      id: ids.courseA,
      schoolId: ids.school,
      schoolYearId: ids.schoolYear,
      name: '4to A Informatica',
      grade: '4to',
      section: 'A',
      area: 'Informatica',
      modality: 'Tecnico Profesional',
      titularId: ids.teacherTitular,
    },
  });

  await prisma.course.upsert({
    where: { id: ids.courseB },
    update: {
      schoolId: ids.school,
      schoolYearId: ids.schoolYear,
      name: '4to B Informatica',
      grade: '4to',
      section: 'B',
      area: 'Informatica',
      modality: 'Tecnico Profesional',
      titularId: ids.teacherAcademic,
    },
    create: {
      id: ids.courseB,
      schoolId: ids.school,
      schoolYearId: ids.schoolYear,
      name: '4to B Informatica',
      grade: '4to',
      section: 'B',
      area: 'Informatica',
      modality: 'Tecnico Profesional',
      titularId: ids.teacherAcademic,
    },
  });

  await Promise.all([
    upsertStudent(ids.studentOne, ids.courseA, 1, 'Estudiante', 'Demo Uno'),
    upsertStudent(ids.studentTwo, ids.courseA, 2, 'Estudiante', 'Demo Dos'),
    upsertStudent(ids.studentThree, ids.courseB, 1, 'Estudiante', 'Demo Tres'),
  ]);

  await Promise.all([
    upsertUser({
      id: ids.superAdmin,
      email: 'superadmin.demo@calificaciones.local',
      fullName: 'Super Admin Demo',
      role: UserRole.SUPER_ADMIN,
      schoolId: null,
      teacherId: null,
    }),
    upsertUser({
      id: ids.admin,
      email: '1988informatica@gmail.com',
      fullName: 'Usuario Demo',
      role: UserRole.ADMIN,
      schoolId: ids.school,
      teacherId: null,
    }),
    upsertUser({
      id: ids.titularUser,
      email: 'titular.demo@calificaciones.local',
      fullName: 'Maestro Titular Demo',
      role: UserRole.TEACHER,
      schoolId: ids.school,
      teacherId: ids.teacherTitular,
    }),
    upsertUser({
      id: ids.academicUser,
      email: 'academico.demo@calificaciones.local',
      fullName: 'Docente Academico Demo',
      role: UserRole.TEACHER,
      schoolId: ids.school,
      teacherId: ids.teacherAcademic,
    }),
    upsertUser({
      id: ids.technicalUser,
      email: 'tecnico.demo@calificaciones.local',
      fullName: 'Docente Tecnico Demo',
      role: UserRole.TEACHER,
      schoolId: ids.school,
      teacherId: ids.teacherTechnical,
    }),
  ]);

  await Promise.all([
    upsertSubject(ids.spanish, 'Lengua Espanola', SubjectType.ACADEMIC),
    upsertSubject(ids.math, 'Matematica', SubjectType.ACADEMIC),
    upsertSubject(ids.biology, 'Biologia', SubjectType.ACADEMIC),
    upsertSubject(ids.webDesign, 'Diseno de Portales Web', SubjectType.TECHNICAL),
    upsertSubject(ids.database, 'Base de Datos', SubjectType.TECHNICAL),
  ]);
}

async function seedTeacherAssignments(): Promise<void> {
  const assignments = [
    [ids.teacherAcademic, ids.spanish, ids.courseA],
    [ids.teacherAcademic, ids.math, ids.courseA],
    [ids.teacherAcademic, ids.biology, ids.courseA],
    [ids.teacherTechnical, ids.webDesign, ids.courseA],
    [ids.teacherTechnical, ids.database, ids.courseA],
    [ids.teacherAcademic, ids.spanish, ids.courseB],
    [ids.teacherTechnical, ids.webDesign, ids.courseB],
  ] as const;

  for (const [teacherId, subjectId, courseId] of assignments) {
    await prisma.teacherAssignment.upsert({
      where: {
        schoolId_schoolYearId_courseId_subjectId: {
          schoolId: ids.school,
          schoolYearId: ids.schoolYear,
          courseId,
          subjectId,
        },
      },
      update: {
        teacherId,
        isActive: true,
      },
      create: {
        schoolId: ids.school,
        schoolYearId: ids.schoolYear,
        teacherId,
        subjectId,
        courseId,
        isActive: true,
      },
    });
  }
}

async function seedTechnicalLearningOutcomes(): Promise<void> {
  const outcomes = [
    [
      technicalOutcomeIds.webRa1,
      ids.webDesign,
      'RA1',
      'Construye estructura HTML semantica',
      30,
      1,
    ],
    [technicalOutcomeIds.webRa2, ids.webDesign, 'RA2', 'Aplica estilos CSS responsivos', 35, 2],
    [technicalOutcomeIds.webRa3, ids.webDesign, 'RA3', 'Publica y prueba portales web', 35, 3],
    [technicalOutcomeIds.dbRa1, ids.database, 'RA1', 'Modela bases de datos relacionales', 50, 1],
    [technicalOutcomeIds.dbRa2, ids.database, 'RA2', 'Consulta datos con SQL', 50, 2],
  ] as const;

  for (const [id, subjectId, code, name, weight, order] of outcomes) {
    await prisma.technicalLearningOutcome.upsert({
      where: { schoolId_subjectId_code: { schoolId: ids.school, subjectId, code } },
      update: { name, weight, order, isActive: true },
      create: {
        id,
        schoolId: ids.school,
        subjectId,
        code,
        name,
        weight,
        order,
        isActive: true,
      },
    });
  }
}

async function seedAcademicGrades(): Promise<void> {
  await seedAcademicSubject(ids.studentOne, ids.courseA, ids.spanish, [
    [78, 82, 84, 80],
    [88, 86, 90, 85],
    [72, 75, 80, 78],
    [91, 89, 92, 90],
  ]);
  await seedAcademicSubject(ids.studentOne, ids.courseA, ids.math, [
    [65, 70, 68, 72],
    [74, 77, 75, 76],
    [80, 82, 78, 79],
    [83, 85, 84, 86],
  ]);
  await seedAcademicSubject(ids.studentTwo, ids.courseA, ids.spanish, [
    [60, 65, 62, 64],
    [70, 72, 71, 73],
    [66, 69, 68, 67],
    [74, 76, 75, 77],
  ]);
  await seedAcademicSubject(ids.studentThree, ids.courseB, ids.spanish, [
    [80, 81, 82, 83],
    [84, 85, 86, 87],
    [88, 89, 90, 91],
    [92, 93, 94, 95],
  ]);
}

async function seedTechnicalGrades(): Promise<void> {
  await seedTechnicalModule(ids.studentOne, ids.courseA, ids.webDesign, [
    [technicalOutcomeIds.webRa1, 26, null, null, null],
    [technicalOutcomeIds.webRa2, 30, null, null, null],
    [technicalOutcomeIds.webRa3, 31, null, null, null],
  ]);
  await seedTechnicalModule(ids.studentOne, ids.courseA, ids.database, [
    [technicalOutcomeIds.dbRa1, 42, null, null, null],
    [technicalOutcomeIds.dbRa2, 41, null, null, null],
  ]);
  await seedTechnicalModule(ids.studentTwo, ids.courseA, ids.webDesign, [
    [technicalOutcomeIds.webRa1, 18, 21, null, null],
    [technicalOutcomeIds.webRa2, 19, 24, null, null],
    [technicalOutcomeIds.webRa3, 18, 23, null, null],
  ]);
}

async function seedAuditLog(): Promise<void> {
  const admin = await prisma.user.findUnique({
    where: { email: '1988informatica@gmail.com' },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      schoolId: ids.school,
      userId: admin?.id,
      entity: 'Seed',
      entityId: ids.school,
      action: AuditAction.CREATE,
      newValue: { message: 'Seed data refreshed' },
    },
  });
}

async function upsertTeacher(id: string, name: string): Promise<void> {
  await prisma.teacher.upsert({
    where: { id },
    update: { name, schoolId: ids.school },
    create: { id, schoolId: ids.school, name },
  });
}

async function upsertStudent(
  id: string,
  courseId: string,
  listNumber: number,
  firstName: string,
  lastName: string,
): Promise<void> {
  await prisma.student.upsert({
    where: {
      schoolId_schoolYearId_courseId_listNumber: {
        schoolId: ids.school,
        schoolYearId: ids.schoolYear,
        courseId,
        listNumber,
      },
    },
    update: { firstName, lastName },
    create: {
      id,
      schoolId: ids.school,
      schoolYearId: ids.schoolYear,
      courseId,
      listNumber,
      firstName,
      lastName,
    },
  });
}

async function upsertUser(params: {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolId: string | null;
  teacherId: string | null;
}): Promise<void> {
  await prisma.user.upsert({
    where: { email: params.email },
    update: {
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      fullName: params.fullName,
      role: params.role,
      isActive: true,
    },
    create: {
      id: params.id,
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      isActive: true,
    },
  });
}

async function upsertSubject(id: string, name: string, type: SubjectType): Promise<void> {
  await prisma.subject.upsert({
    where: { schoolId_name: { schoolId: ids.school, name } },
    update: { type, isActive: true },
    create: {
      id,
      schoolId: ids.school,
      name,
      type,
      isActive: true,
    },
  });
}

async function seedAcademicSubject(
  studentId: string,
  courseId: string,
  subjectId: string,
  blocks: Array<[number, number, number, number]>,
): Promise<void> {
  const pcs: number[] = [];

  for (const [index, scores] of blocks.entries()) {
    const pc = roundOneDecimal(average(scores));
    pcs.push(pc);

    await prisma.academicGrade.upsert({
      where: {
        schoolId_schoolYearId_studentId_subjectId_blockNumber: {
          schoolId: ids.school,
          schoolYearId: ids.schoolYear,
          studentId,
          subjectId,
          blockNumber: index + 1,
        },
      },
      update: {
        p1: scores[0],
        p2: scores[1],
        p3: scores[2],
        p4: scores[3],
        pc,
      },
      create: {
        schoolId: ids.school,
        schoolYearId: ids.schoolYear,
        courseId,
        studentId,
        subjectId,
        blockNumber: index + 1,
        p1: scores[0],
        p2: scores[1],
        p3: scores[2],
        p4: scores[3],
        pc,
      },
    });
  }

  const cf = Math.round(average(pcs));

  await prisma.academicSubjectResult.upsert({
    where: {
      schoolId_schoolYearId_studentId_subjectId: {
        schoolId: ids.school,
        schoolYearId: ids.schoolYear,
        studentId,
        subjectId,
      },
    },
    update: {
      pc1: pcs[0],
      pc2: pcs[1],
      pc3: pcs[2],
      pc4: pcs[3],
      cf,
      status: cf >= 70 ? SubjectStatus.APPROVED : SubjectStatus.COMPLETIVA,
    },
    create: {
      schoolId: ids.school,
      schoolYearId: ids.schoolYear,
      courseId,
      studentId,
      subjectId,
      pc1: pcs[0],
      pc2: pcs[1],
      pc3: pcs[2],
      pc4: pcs[3],
      cf,
      status: cf >= 70 ? SubjectStatus.APPROVED : SubjectStatus.COMPLETIVA,
    },
  });
}

async function seedTechnicalModule(
  studentId: string,
  courseId: string,
  subjectId: string,
  scores: Array<[string, number, number | null, number | null, number | null]>,
): Promise<void> {
  let totalScore = 0;
  let hasAllScores = true;
  let hasSpecial = false;

  for (const [
    learningOutcomeId,
    ordinaryScore,
    recovery1Score,
    recovery2Score,
    specialScore,
  ] of scores) {
    const validScore = specialScore ?? recovery2Score ?? recovery1Score ?? ordinaryScore;
    totalScore += validScore;
    hasAllScores = hasAllScores && validScore !== null;
    hasSpecial = hasSpecial || specialScore !== null;

    await prisma.technicalGrade.upsert({
      where: {
        schoolId_schoolYearId_studentId_learningOutcomeId: {
          schoolId: ids.school,
          schoolYearId: ids.schoolYear,
          studentId,
          learningOutcomeId,
        },
      },
      update: {
        ordinaryScore,
        recovery1Score,
        recovery2Score,
        specialScore,
        validScore,
      },
      create: {
        schoolId: ids.school,
        schoolYearId: ids.schoolYear,
        courseId,
        studentId,
        subjectId,
        learningOutcomeId,
        ordinaryScore,
        recovery1Score,
        recovery2Score,
        specialScore,
        validScore,
      },
    });
  }

  const status = !hasAllScores
    ? SubjectStatus.PENDING
    : totalScore >= 70
      ? SubjectStatus.APPROVED
      : hasSpecial
        ? SubjectStatus.FAILED
        : SubjectStatus.SPECIAL;

  await prisma.technicalSubjectResult.upsert({
    where: {
      schoolId_schoolYearId_studentId_subjectId: {
        schoolId: ids.school,
        schoolYearId: ids.schoolYear,
        studentId,
        subjectId,
      },
    },
    update: {
      totalScore,
      finalScore: Math.round(totalScore),
      status,
    },
    create: {
      schoolId: ids.school,
      schoolYearId: ids.schoolYear,
      courseId,
      studentId,
      subjectId,
      totalScore,
      finalScore: Math.round(totalScore),
      status,
    },
  });
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

main()
  .then(async () => {
    console.log('Seed completed');
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
