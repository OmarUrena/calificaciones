import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(dto: CreateSubjectDto, user: AuthenticatedUser) {
    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);

    try {
      return await this.prisma.subject.create({
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
    if (user.role === UserRole.TEACHER) {
      return this.prisma.subject.findMany({
        where: {
          schoolId: user.schoolId ?? '',
          teacherAssignments: {
            some: {
              teacherId: user.teacherId ?? '',
              isActive: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    }

    return this.prisma.subject.findMany({
      where: user.role === UserRole.SUPER_ADMIN ? undefined : { schoolId: user.schoolId ?? '' },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, subject.schoolId);

    if (user.role === UserRole.TEACHER) {
      const assignment = await this.prisma.teacherAssignment.findFirst({
        where: {
          schoolId: subject.schoolId,
          subjectId: subject.id,
          teacherId: user.teacherId ?? '',
          isActive: true,
        },
        select: { id: true },
      });

      if (!assignment) {
        throw new NotFoundException('Subject not found.');
      }
    }

    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto, user: AuthenticatedUser) {
    await this.findOne(id, user);

    try {
      return await this.prisma.subject.update({
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

    return this.prisma.subject.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: user.id,
      },
    });
  }
}
