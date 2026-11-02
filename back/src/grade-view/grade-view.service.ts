import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubjectType, UserRole } from '@prisma/client';

import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GradeViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  private courseScope(user: AuthenticatedUser): Prisma.CourseWhereInput {
    return {
      ...(user.role === UserRole.SUPER_ADMIN ? {} : { schoolId: user.schoolId ?? '' }),
      ...(user.role === UserRole.TEACHER
        ? { OR: [
            { titularId: user.teacherId ?? '' },
            { teacherAssignments: { some: { teacherId: user.teacherId ?? '', isActive: true } } },
          ] }
        : {}),
    };
  }

  findCourses(user: AuthenticatedUser) {
    return this.prisma.course.findMany({
      where: this.courseScope(user),
      include: { schoolYear: true, school: { select: { id: true, name: true } } },
      orderBy: [{ schoolYear: { name: 'desc' } }, { grade: 'asc' }, { section: 'asc' }, { name: 'asc' }],
    });
  }

  private async findCourse(courseId: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findFirst({
      where: { ...this.courseScope(user), id: courseId },
      include: { schoolYear: true },
    });
    if (!course) throw new NotFoundException('Curso no disponible para tu usuario.');
    this.permissions.ensureCanAccessSchool(user, course.schoolId);
    return course;
  }

  async findSubjects(courseId: string, user: AuthenticatedUser) {
    const course = await this.findCourse(courseId, user);
    const subjects = await this.findCourseSubjects(course, user);
    const scope = {
      schoolId: course.schoolId, schoolYearId: course.schoolYearId, courseId,
      subjectId: { in: subjects.map((subject) => subject.id) },
    };
    const [students, assignments, academicGrades, technicalGrades, outcomes] = await Promise.all([
      this.prisma.student.findMany({
        where: { schoolId: course.schoolId, schoolYearId: course.schoolYearId, courseId },
        select: { id: true },
      }),
      this.prisma.teacherAssignment.findMany({
        where: { ...scope, isActive: true },
        select: { subjectId: true, teacher: { select: { name: true } } },
      }),
      this.prisma.academicGrade.findMany({
        where: scope,
        select: { subjectId: true, studentId: true, p1: true, rp1: true, p2: true, rp2: true, p3: true, rp3: true, p4: true, rp4: true },
      }),
      this.prisma.technicalGrade.findMany({
        where: scope,
        select: { subjectId: true, studentId: true, learningOutcomeId: true, ordinaryScore: true, recovery1Score: true, recovery2Score: true, specialScore: true },
      }),
      this.prisma.technicalLearningOutcome.findMany({
        where: {
          schoolId: course.schoolId, subjectId: scope.subjectId,
          OR: [{ isActive: true }, { technicalGrades: { some: scope } }],
        },
        select: { id: true, subjectId: true, code: true },
        orderBy: { order: 'asc' },
      }),
    ]);
    const studentIds = new Set(students.map((student) => student.id));
    return subjects.map((subject) => {
      const academic = academicGrades.filter((grade) => grade.subjectId === subject.id && studentIds.has(grade.studentId));
      const technical = technicalGrades.filter((grade) => grade.subjectId === subject.id && studentIds.has(grade.studentId));
      const progress = subject.type === SubjectType.ACADEMIC
        ? ([['p1', 'rp1'], ['p2', 'rp2'], ['p3', 'rp3'], ['p4', 'rp4']] as const).map(([ordinary, recovery], index) => ({
            label: `P${index + 1}`,
            studentsWithGrades: new Set(academic.filter((grade) => grade[ordinary] !== null || grade[recovery] !== null).map((grade) => grade.studentId)).size,
          }))
        : outcomes.filter((outcome) => outcome.subjectId === subject.id).map((outcome) => ({
            label: outcome.code,
            studentsWithGrades: new Set(technical.filter((grade) => grade.learningOutcomeId === outcome.id &&
              [grade.ordinaryScore, grade.recovery1Score, grade.recovery2Score, grade.specialScore].some((value) => value !== null),
            ).map((grade) => grade.studentId)).size,
          }));
      const studentsWithGrades = new Set(subject.type === SubjectType.ACADEMIC
        ? academic.filter((grade) => [grade.p1, grade.rp1, grade.p2, grade.rp2, grade.p3, grade.rp3, grade.p4, grade.rp4].some((value) => value !== null)).map((grade) => grade.studentId)
        : technical.filter((grade) => [grade.ordinaryScore, grade.recovery1Score, grade.recovery2Score, grade.specialScore].some((value) => value !== null)).map((grade) => grade.studentId),
      ).size;
      return {
        ...subject,
        teachers: assignments.filter((assignment) => assignment.subjectId === subject.id).map((assignment) => assignment.teacher.name),
        studentCount: students.length,
        studentsWithGrades,
        progress,
      };
    });
  }

  private findCourseSubjects(
    course: { id: string; schoolId: string; schoolYearId: string; titularId?: string | null },
    user: AuthenticatedUser,
  ) {
    const scope = { schoolId: course.schoolId, schoolYearId: course.schoolYearId, courseId: course.id };
    return this.prisma.subject.findMany({
      where: {
        schoolId: course.schoolId,
        ...(user.role === UserRole.TEACHER && (!user.teacherId || course.titularId !== user.teacherId)
          ? {
              teacherAssignments: {
                some: { ...scope, teacherId: user.teacherId ?? '', isActive: true },
              },
            }
          : {
              OR: [
                { teacherAssignments: { some: scope } },
                { academicGrades: { some: scope } },
                { academicSubjectResults: { some: scope } },
                { technicalGrades: { some: scope } },
                { technicalSubjectResults: { some: scope } },
              ],
            }),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findRegister(courseId: string, subjectId: string, user: AuthenticatedUser) {
    const course = await this.findCourse(courseId, user);
    const subjects = await this.findCourseSubjects(course, user);
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject) throw new NotFoundException('Asignatura no disponible para tu usuario en este curso.');

    const scope = { schoolId: course.schoolId, schoolYearId: course.schoolYearId, courseId, subjectId };
    const students = await this.prisma.student.findMany({
      where: { schoolId: course.schoolId, schoolYearId: course.schoolYearId, courseId },
      orderBy: { listNumber: 'asc' },
    });

    if (subject.type === SubjectType.ACADEMIC) {
      const [grades, results] = await Promise.all([
        this.prisma.academicGrade.findMany({ where: scope, orderBy: { blockNumber: 'asc' } }),
        this.prisma.academicSubjectResult.findMany({ where: scope }),
      ]);
      return { type: 'ACADEMIC' as const, course, subject, students, grades, results };
    }

    const [grades, results, learningOutcomes] = await Promise.all([
      this.prisma.technicalGrade.findMany({ where: scope }),
      this.prisma.technicalSubjectResult.findMany({ where: scope }),
      this.prisma.technicalLearningOutcome.findMany({
        where: {
          schoolId: course.schoolId,
          subjectId,
          OR: [{ isActive: true }, { technicalGrades: { some: scope } }],
        },
        orderBy: { order: 'asc' },
      }),
    ]);
    return { type: 'TECHNICAL' as const, course, subject, students, grades, results, learningOutcomes };
  }
}
