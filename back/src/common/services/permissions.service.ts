import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  ensureCanAccessSchool(user: AuthenticatedUser, schoolId: string): void {
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (!user.schoolId || user.schoolId !== schoolId) {
      throw new ForbiddenException('You cannot access data from another school.');
    }
  }

  async ensureTeacherCanManageSubject(params: {
    user: AuthenticatedUser;
    schoolId: string;
    schoolYearId?: string;
    courseId: string;
    subjectId: string;
  }): Promise<void> {
    const { user, schoolId, schoolYearId, courseId, subjectId } = params;

    this.ensureCanAccessSchool(user, schoolId);

    if (user.role !== UserRole.TEACHER) {
      return;
    }

    if (!user.teacherId) {
      throw new ForbiddenException('Teacher users must be linked to a teacher record.');
    }

    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: {
        schoolId,
        courseId,
        subjectId,
        teacherId: user.teacherId,
        isActive: true,
        ...(schoolYearId ? { schoolYearId } : {}),
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this course subject.');
    }
  }

  async ensureTeacherCanGenerateCourseReport(params: {
    user: AuthenticatedUser;
    courseId: string;
  }): Promise<void> {
    const { user, courseId } = params;

    if (user.role !== UserRole.TEACHER) {
      return;
    }

    if (!user.teacherId) {
      throw new ForbiddenException('Teacher users must be linked to a teacher record.');
    }

    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        schoolId: user.schoolId ?? undefined,
        titularId: user.teacherId,
      },
      select: { id: true },
    });

    if (!course) {
      throw new ForbiddenException('Only the titular teacher can generate this course report.');
    }
  }
}
