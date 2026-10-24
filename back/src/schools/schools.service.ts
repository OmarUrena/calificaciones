import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolLogoStorageService, SchoolLogoFile } from './school-logo-storage.service';

@Injectable()
export class SchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly logoStorage: SchoolLogoStorageService,
    private readonly authService: AuthService,
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

  async remove(id: string, password: string, user: AuthenticatedUser) {
    const school = await this.findOne(id, user);
    await this.authService.verifyPassword(user.email, password);

    await this.prisma.$transaction(async (tx) => {
      const bySchool = { schoolId: id };

      await tx.auditLog.deleteMany({ where: bySchool });
      await tx.importJob.deleteMany({ where: bySchool });
      await tx.academicGrade.deleteMany({ where: bySchool });
      await tx.academicSubjectResult.deleteMany({ where: bySchool });
      await tx.technicalGrade.deleteMany({ where: bySchool });
      await tx.technicalSubjectResult.deleteMany({ where: bySchool });
      await tx.teacherAssignment.deleteMany({ where: bySchool });
      await tx.technicalLearningOutcome.deleteMany({ where: bySchool });
      await tx.student.deleteMany({ where: bySchool });
      await tx.course.deleteMany({ where: bySchool });
      await tx.subject.deleteMany({ where: bySchool });
      await tx.schoolYear.deleteMany({ where: bySchool });
      await tx.user.deleteMany({ where: bySchool });
      await tx.teacher.deleteMany({ where: bySchool });
      await tx.school.delete({ where: { id } });
    });

    return { id: school.id, name: school.name, deleted: true };
  }

  async uploadLogo(id: string, file: SchoolLogoFile | undefined, user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('No tienes permiso para modificar el logo de la escuela.');
    }
    await this.findOne(id, user);
    const logoUrl = await this.logoStorage.upload(id, file);
    return this.update(id, { logoUrl }, user);
  }
}
