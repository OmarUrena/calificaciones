import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateStudentDto, user: AuthenticatedUser) {
    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);
    await this.validateCourseAndSchoolYear(dto.schoolId, dto.schoolYearId, dto.courseId);

    try {
      const student = await this.prisma.student.create({
        data: {
          ...dto,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      await this.auditService.logCreate({
        schoolId: student.schoolId,
        userId: user.id,
        entity: 'Student',
        entityId: student.id,
        newValue: student,
      });

      return student;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.student.findMany({
      where: user.role === UserRole.SUPER_ADMIN ? undefined : { schoolId: user.schoolId ?? '' },
      include: { course: true, schoolYear: true },
      orderBy: [{ courseId: 'asc' }, { listNumber: 'asc' }],
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { course: true, schoolYear: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, student.schoolId);
    return student;
  }

  async update(id: string, dto: UpdateStudentDto, user: AuthenticatedUser) {
    const oldValue = await this.findOne(id, user);
    const schoolYearId = dto.schoolYearId ?? oldValue.schoolYearId;
    const courseId = dto.courseId ?? oldValue.courseId;

    await this.validateCourseAndSchoolYear(oldValue.schoolId, schoolYearId, courseId);

    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: {
          ...dto,
          updatedBy: user.id,
        },
      });
      await this.auditService.logUpdate({
        schoolId: student.schoolId,
        userId: user.id,
        entity: 'Student',
        entityId: student.id,
        oldValue,
        newValue: student,
      });

      return student;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    const oldValue = await this.findOne(id, user);
    const student = await this.prisma.student.delete({ where: { id } });
    await this.auditService.logDelete({
      schoolId: student.schoolId,
      userId: user.id,
      entity: 'Student',
      entityId: student.id,
      oldValue,
    });

    return student;
  }

  private async validateCourseAndSchoolYear(
    schoolId: string,
    schoolYearId: string,
    courseId: string,
  ): Promise<void> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId, schoolYearId },
      select: { id: true },
    });

    if (!course) {
      throw new BadRequestException('Course must belong to the same school and school year.');
    }
  }
}
