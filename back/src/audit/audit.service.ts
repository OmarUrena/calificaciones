import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, UserRole } from '@prisma/client';

import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

type AuditLogInput = {
  schoolId: string;
  userId?: string | null;
  entity: string;
  entityId: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(dto: CreateAuditLogDto, user: AuthenticatedUser) {
    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);

    return this.log({
      ...dto,
      userId: dto.userId ?? user.id,
    });
  }

  findAll(query: AuditQueryDto, user: AuthenticatedUser) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { schoolId: user.schoolId ?? '' }),
        ...query,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const auditLog = await this.prisma.auditLog.findUnique({ where: { id } });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, auditLog.schoolId);
    return auditLog;
  }

  logCreate(input: Omit<AuditLogInput, 'action' | 'oldValue'>) {
    return this.log({ ...input, action: AuditAction.CREATE });
  }

  logUpdate(input: Omit<AuditLogInput, 'action'>) {
    return this.log({ ...input, action: AuditAction.UPDATE });
  }

  logDelete(input: Omit<AuditLogInput, 'action' | 'newValue'>) {
    return this.log({ ...input, action: AuditAction.DELETE });
  }

  logImport(input: Omit<AuditLogInput, 'action' | 'oldValue'>) {
    return this.log({ ...input, action: AuditAction.IMPORT });
  }

  logGenerateReport(input: Omit<AuditLogInput, 'action' | 'oldValue'>) {
    return this.log({ ...input, action: AuditAction.GENERATE_REPORT });
  }

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        schoolId: input.schoolId,
        userId: input.userId ?? null,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        oldValue: this.toJson(input.oldValue),
        newValue: this.toJson(input.newValue),
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
