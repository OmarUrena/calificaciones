import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

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
  ) {}

  async create(dto: CreateSchoolDto, user: AuthenticatedUser) {
    try {
      return await this.prisma.school.create({
        data: {
          ...dto,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
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
    await this.findOne(id, user);

    try {
      return await this.prisma.school.update({
        where: { id },
        data: {
          ...dto,
          updatedBy: user.id,
        },
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user);

    return this.prisma.school.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: user.id,
      },
    });
  }
}
