import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateSchoolDto, user: AuthenticatedUser) {
    try {
      const school = await this.prisma.school.create({
        data: {
          ...dto,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      await this.auditService.logCreate({
        schoolId: school.id,
        userId: user.id,
        entity: 'School',
        entityId: school.id,
        newValue: school,
      });

      return school;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  findAll(user: AuthenticatedUser) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.prisma.school.findMany({ orderBy: { name: 'asc' } });
    }

    if (!user.schoolId) {
      throw new ForbiddenException('User is not linked to a school.');
    }

    return this.prisma.school.findMany({
      where: { id: user.schoolId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const school = await this.prisma.school.findUnique({ where: { id } });

    if (!school) {
      throw new NotFoundException('School not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, school.id);
    return school;
  }

  async update(id: string, dto: UpdateSchoolDto, user: AuthenticatedUser) {
    const oldValue = await this.findOne(id, user);

    try {
      const school = await this.prisma.school.update({
        where: { id },
        data: {
          ...dto,
          updatedBy: user.id,
        },
      });
      await this.auditService.logUpdate({
        schoolId: school.id,
        userId: user.id,
        entity: 'School',
        entityId: school.id,
        oldValue,
        newValue: school,
      });

      return school;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    const oldValue = await this.findOne(id, user);
    const school = await this.prisma.school.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: user.id,
      },
    });
    await this.auditService.logDelete({
      schoolId: school.id,
      userId: user.id,
      entity: 'School',
      entityId: school.id,
      oldValue,
    });

    return school;
  }
}
