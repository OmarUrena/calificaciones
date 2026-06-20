import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, user: AuthenticatedUser) {
    this.ensureCanManageUserPayload(dto, user);
    await this.validateTeacher(dto.schoolId, dto.teacherId);

    try {
      const createdUser = await this.prisma.user.create({
        data: {
          ...dto,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      if (createdUser.schoolId) {
        await this.auditService.logCreate({
          schoolId: createdUser.schoolId,
          userId: user.id,
          entity: 'User',
          entityId: createdUser.id,
          newValue: createdUser,
        });
      }

      return createdUser;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.user.findMany({
      where: user.role === UserRole.SUPER_ADMIN ? undefined : { schoolId: user.schoolId ?? '' },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({ where: { id } });

    if (!target) {
      throw new NotFoundException('User not found.');
    }

    if (target.schoolId) {
      this.permissionsService.ensureCanAccessSchool(user, target.schoolId);
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can access global users.');
    }

    return target;
  }

  async update(id: string, dto: UpdateUserDto, user: AuthenticatedUser) {
    const current = await this.findOne(id, user);
    const schoolId = dto.schoolId ?? current.schoolId ?? undefined;

    this.ensureCanManageUserPayload({ ...dto, schoolId, role: dto.role ?? current.role }, user);
    await this.validateTeacher(schoolId, dto.teacherId);

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          ...dto,
          updatedBy: user.id,
        },
      });
      if (updatedUser.schoolId) {
        await this.auditService.logUpdate({
          schoolId: updatedUser.schoolId,
          userId: user.id,
          entity: 'User',
          entityId: updatedUser.id,
          oldValue: current,
          newValue: updatedUser,
        });
      }

      return updatedUser;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    const oldValue = await this.findOne(id, user);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: user.id,
      },
    });
    if (updatedUser.schoolId) {
      await this.auditService.logDelete({
        schoolId: updatedUser.schoolId,
        userId: user.id,
        entity: 'User',
        entityId: updatedUser.id,
        oldValue,
      });
    }

    return updatedUser;
  }

  private ensureCanManageUserPayload(
    dto: Pick<CreateUserDto, 'schoolId' | 'role'>,
    user: AuthenticatedUser,
  ): void {
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admins cannot manage super admin users.');
    }

    if (!dto.schoolId) {
      throw new BadRequestException('School is required for non-super-admin users.');
    }

    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);
  }

  private async validateTeacher(schoolId?: string, teacherId?: string): Promise<void> {
    if (!teacherId) {
      return;
    }

    if (!schoolId) {
      throw new BadRequestException('Teacher users must belong to a school.');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, schoolId },
      select: { id: true },
    });

    if (!teacher) {
      throw new BadRequestException('Teacher must belong to the same school.');
    }
  }
}
