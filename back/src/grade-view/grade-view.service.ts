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
        ? { teacherAssignments: { some: { teacherId: user.teacherId ?? '', isActive: true } } }
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
    return this.findCourseSubjects(course, user);
  }

  private findCourseSubjects(
    course: { id: string; schoolId: string; schoolYearId: string },
    user: AuthenticatedUser,
  ) {
    const scope = { schoolId: course.schoolId, schoolYearId: course.schoolYearId, courseId: course.id };
    return this.prisma.subject.findMany({
      where: {
        schoolId: course.schoolId,
        ...(user.role === UserRole.TEACHER
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
