import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCourseDto, user: AuthenticatedUser) {
    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);
    await this.validateSchoolYear(dto.schoolId, dto.schoolYearId);
    await this.validateTitular(dto.schoolId, dto.titularId);

    const course = await this.prisma.course.create({
      data: {
        ...dto,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    await this.auditService.logCreate({
      schoolId: course.schoolId,
      userId: user.id,
      entity: 'Course',
      entityId: course.id,
      newValue: course,
    });

    return course;
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.course.findMany({
      where: user.role === UserRole.SUPER_ADMIN ? undefined : { schoolId: user.schoolId ?? '' },
      include: { schoolYear: true, titular: true },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { schoolYear: true, titular: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, course.schoolId);
    return course;
  }

  async update(id: string, dto: UpdateCourseDto, user: AuthenticatedUser) {
    const oldValue = await this.findOne(id, user);

    if (dto.schoolYearId) {
      await this.validateSchoolYear(oldValue.schoolId, dto.schoolYearId);
    }

    await this.validateTitular(oldValue.schoolId, dto.titularId);

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: user.id,
      },
    });
    await this.auditService.logUpdate({
      schoolId: course.schoolId,
      userId: user.id,
      entity: 'Course',
      entityId: course.id,
      oldValue,
      newValue: course,
    });

    return course;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const oldValue = await this.findOne(id, user);
    const course = await this.prisma.course.delete({ where: { id } });
    await this.auditService.logDelete({
      schoolId: course.schoolId,
      userId: user.id,
      entity: 'Course',
      entityId: course.id,
      oldValue,
    });

    return course;
  }

  private async validateSchoolYear(schoolId: string, schoolYearId: string): Promise<void> {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: schoolYearId, schoolId },
      select: { id: true },
    });

    if (!schoolYear) {
      throw new BadRequestException('School year must belong to the same school.');
    }
  }

  private async validateTitular(schoolId: string, titularId?: string): Promise<void> {
    if (!titularId) {
      return;
    }

    const titular = await this.prisma.teacher.findFirst({
      where: { id: titularId, schoolId },
      select: { id: true },
    });

    if (!titular) {
      throw new BadRequestException('Titular teacher must belong to the same school.');
    }
  }
}
