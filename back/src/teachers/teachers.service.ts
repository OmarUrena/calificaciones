import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  create(dto: CreateTeacherDto, user: AuthenticatedUser) {
    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);

    return this.prisma.teacher.create({
      data: {
        ...dto,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.teacher.findMany({
      where: user.role === UserRole.SUPER_ADMIN ? undefined : { schoolId: user.schoolId ?? '' },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id } });

    if (!teacher) {
      throw new NotFoundException('Teacher not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, teacher.schoolId);
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto, user: AuthenticatedUser) {
    await this.findOne(id, user);

    return this.prisma.teacher.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: user.id,
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.teacher.delete({ where: { id } });
  }
}
