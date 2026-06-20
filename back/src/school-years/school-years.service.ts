import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolYearDto } from './dto/create-school-year.dto';
import { UpdateSchoolYearDto } from './dto/update-school-year.dto';

@Injectable()
export class SchoolYearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateSchoolYearDto, user: AuthenticatedUser) {
    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);

    try {
      const schoolYear = await this.prisma.schoolYear.create({
        data: {
          ...dto,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      await this.auditService.logCreate({
        schoolId: schoolYear.schoolId,
        userId: user.id,
        entity: 'SchoolYear',
        entityId: schoolYear.id,
        newValue: schoolYear,
      });

      return schoolYear;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.schoolYear.findMany({
      where: user.role === UserRole.SUPER_ADMIN ? undefined : { schoolId: user.schoolId ?? '' },
      orderBy: [{ isActive: 'desc' }, { name: 'desc' }],
    });
  }

  async update(id: string, dto: UpdateSchoolYearDto, user: AuthenticatedUser) {
    const oldValue = await this.findAccessibleById(id, user);

    try {
      const schoolYear = await this.prisma.schoolYear.update({
        where: { id: oldValue.id },
        data: {
          ...dto,
          updatedBy: user.id,
        },
      });
      await this.auditService.logUpdate({
        schoolId: schoolYear.schoolId,
        userId: user.id,
        entity: 'SchoolYear',
        entityId: schoolYear.id,
        oldValue,
        newValue: schoolYear,
      });

      return schoolYear;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async activate(id: string, user: AuthenticatedUser) {
    const oldValue = await this.findAccessibleById(id, user);

    const schoolYear = await this.prisma.$transaction(async (tx) => {
      await tx.schoolYear.updateMany({
        where: { schoolId: oldValue.schoolId },
        data: { isActive: false, updatedBy: user.id },
      });

      return tx.schoolYear.update({
        where: { id: oldValue.id },
        data: { isActive: true, updatedBy: user.id },
      });
    });
    await this.auditService.logUpdate({
      schoolId: schoolYear.schoolId,
      userId: user.id,
      entity: 'SchoolYear',
      entityId: schoolYear.id,
      oldValue,
      newValue: schoolYear,
    });

    return schoolYear;
  }

  private async findAccessibleById(id: string, user: AuthenticatedUser) {
    const schoolYear = await this.prisma.schoolYear.findUnique({ where: { id } });

    if (!schoolYear) {
      throw new NotFoundException('School year not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, schoolYear.schoolId);
    return schoolYear;
  }
}
