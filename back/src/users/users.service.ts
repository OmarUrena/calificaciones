import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserAccountsService } from './user-accounts.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly accounts: UserAccountsService,
  ) {}

  async create(dto: CreateUserDto, user: AuthenticatedUser) {
    this.ensureCanManageUserPayload(dto, user);
    await this.validateRelations(dto.schoolId, dto.teacherId, dto.role);
    await this.ensureEmailAvailable(dto.email);
    const { password, ...values } = dto;
    const accountId = password
      ? await this.accounts.create(dto.email, password, dto.fullName)
      : undefined;
    let createdUser;
    try {
      createdUser = await this.prisma.user.create({
        data: {
          ...values,
          ...(accountId ? { id: accountId } : {}),
          teacherId: dto.role === UserRole.TEACHER ? dto.teacherId : null,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
    } catch (error) {
      if (accountId) {
        try {
          await this.accounts.removeCreatedAccount(accountId);
        } catch {
          throw new ServiceUnavailableException(
            'No se pudo completar el registro ni retirar la cuenta de acceso recién creada. Contacta al administrador antes de reintentar.',
          );
        }
      }
      rethrowKnownPrismaError(error);
    }
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
    this.ensureCanModifyTarget(current, user);
    const role = dto.role ?? current.role;
    const schoolId = dto.schoolId !== undefined ? dto.schoolId : current.schoolId;
    const teacherId =
      role === UserRole.TEACHER
        ? dto.teacherId !== undefined
          ? dto.teacherId
          : current.teacherId
        : null;
    if (id === user.id && (dto.isActive === false || role !== current.role)) {
      throw new BadRequestException(
        'No puedes desactivar tu propia cuenta ni cambiar tu propio rol.',
      );
    }
    this.ensureCanManageUserPayload({ schoolId, role }, user);
    await this.validateRelations(schoolId, teacherId, role, id);
    const email = dto.email ?? current.email;
    await this.ensureEmailAvailable(email, id);
    const emailChanged = email !== current.email;
    const accountId = emailChanged ? await this.accounts.find(id, current.email) : undefined;
    if (accountId) await this.accounts.updateEmail(accountId, email);
    let updatedUser;
    try {
      updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          fullName: dto.fullName ?? current.fullName,
          email,
          role,
          schoolId,
          teacherId,
          isActive: dto.isActive ?? current.isActive,
          updatedBy: user.id,
        },
      });
    } catch (error) {
      if (accountId) {
        try {
          await this.accounts.updateEmail(accountId, current.email);
        } catch {
          throw new ServiceUnavailableException(
            'El cambio no se completó y el correo de acceso requiere revisión del administrador.',
          );
        }
      }
      rethrowKnownPrismaError(error);
    }
    const auditSchoolId = updatedUser.schoolId ?? current.schoolId;
    if (auditSchoolId) {
      await this.auditService.logUpdate({
        schoolId: auditSchoolId,
        userId: user.id,
        entity: 'User',
        entityId: updatedUser.id,
        oldValue: current,
        newValue: updatedUser,
      });
    }
    return updatedUser;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const oldValue = await this.findOne(id, user);
    this.ensureCanModifyTarget(oldValue, user);
    if (id === user.id) throw new BadRequestException('No puedes desactivar tu propia cuenta.');

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
    dto: { schoolId?: string | null; role: UserRole },
    user: AuthenticatedUser,
  ): void {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)
      throw new ForbiddenException('No tienes permiso para gestionar usuarios.');
    if (dto.role !== UserRole.SUPER_ADMIN && !dto.schoolId)
      throw new BadRequestException('Selecciona una escuela para el usuario.');
    if (user.role === UserRole.SUPER_ADMIN) return;

    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admins cannot manage super admin users.');
    }

    if (!dto.schoolId) {
      throw new BadRequestException('School is required for non-super-admin users.');
    }

    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);
  }

  private async validateRelations(
    schoolId: string | null | undefined,
    teacherId: string | null | undefined,
    role: UserRole,
    userId?: string,
  ): Promise<void> {
    if (
      schoolId &&
      !(await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } }))
    ) {
      throw new BadRequestException('La escuela seleccionada no existe.');
    }
    if (role === UserRole.TEACHER && !teacherId)
      throw new BadRequestException('Selecciona el maestro vinculado al usuario docente.');
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
    const linked = await this.prisma.user.findFirst({
      where: { teacherId, ...(userId ? { id: { not: userId } } : {}) },
      select: { id: true },
    });
    if (linked) throw new ConflictException('Este maestro ya tiene un usuario vinculado.');
  }

  private ensureCanModifyTarget(target: { role: UserRole }, user: AuthenticatedUser) {
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      (user.role !== UserRole.ADMIN || target.role === UserRole.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('No tienes permiso para modificar este usuario.');
    }
  }

  private async ensureEmailAvailable(email: string, id?: string) {
    const duplicate = await this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
  }
}
