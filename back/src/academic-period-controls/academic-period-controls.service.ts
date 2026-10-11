import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicPeriodControl, AuditAction, Prisma, UserRole } from '@prisma/client';

import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

export const ACADEMIC_PERIOD_FIELDS = ['p1', 'rp1', 'p2', 'rp2', 'p3', 'rp3', 'p4', 'rp4'] as const;
export type AcademicPeriodField = (typeof ACADEMIC_PERIOD_FIELDS)[number];
type ScoreValue = number | string | Prisma.Decimal | null | undefined;
type Scores = Partial<Record<AcademicPeriodField, ScoreValue>>;

@Injectable()
export class AcademicPeriodControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async findForYear(schoolYearId: string, user: AuthenticatedUser) {
    const year = await this.getYear(schoolYearId, user);
    const control = await this.prisma.academicPeriodControl.findUnique({
      where: { schoolId_schoolYearId: { schoolId: year.schoolId, schoolYearId } },
    });
    return this.toResponse(year.schoolId, schoolYearId, control);
  }

  async setOpen(
    schoolYearId: string,
    field: AcademicPeriodField,
    isOpen: boolean,
    user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.TEACHER) {
      throw new ForbiddenException('Solo administración puede configurar los períodos.');
    }
    const year = await this.getYear(schoolYearId, user);
    const key: `${AcademicPeriodField}Open` = `${field}Open`;
    const { control } = await this.prisma.$transaction(async (tx) => {
      await this.lockYear(tx, year.schoolId, schoolYearId);
      const previous = await tx.academicPeriodControl.findUnique({
        where: { schoolId_schoolYearId: { schoolId: year.schoolId, schoolYearId } },
      });
      const oldValue = previous?.[key] ?? true;
      if (oldValue === isOpen) return { control: previous, oldValue };
      const control = await tx.academicPeriodControl.upsert({
        where: { schoolId_schoolYearId: { schoolId: year.schoolId, schoolYearId } },
        create: { schoolId: year.schoolId, schoolYearId, [key]: isOpen, updatedBy: user.id },
        update: { [key]: isOpen, updatedBy: user.id },
      });
      await tx.auditLog.create({
        data: {
          schoolId: year.schoolId,
          userId: user.id,
          entity: 'AcademicPeriodControl',
          entityId: control.id,
          action: AuditAction.UPDATE,
          oldValue: { schoolYearId, field, isOpen: oldValue },
          newValue: { schoolYearId, field, isOpen },
        },
      });
      return { control, oldValue };
    });
    return this.toResponse(year.schoolId, schoolYearId, control);
  }

  async ensureFieldsOpen(
    schoolId: string,
    schoolYearId: string,
    incoming: Scores,
    current?: Scores,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const fields = ACADEMIC_PERIOD_FIELDS.filter((field) => {
      const value = incoming[field];
      if (value === undefined) return false;
      if (!current) return value !== null;
      const existing = current[field];
      return (
        (value === null ? null : Number(value)) !==
        (existing === null || existing === undefined ? null : Number(existing))
      );
    });
    if (fields.length === 0) return;
    const control = await client.academicPeriodControl.findUnique({
      where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
    });
    const closed = fields.find((field) => control?.[`${field}Open`] === false);
    if (closed) {
      throw new ForbiddenException(`${closed.toUpperCase()} está cerrado para este año escolar.`);
    }
  }

  async lockYear(tx: Prisma.TransactionClient, schoolId: string, schoolYearId: string) {
    await tx.$queryRaw`SELECT "id" FROM "school_years" WHERE "id" = ${schoolYearId} AND "schoolId" = ${schoolId} FOR UPDATE`;
  }

  private async getYear(schoolYearId: string, user: AuthenticatedUser) {
    const year = await this.prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { id: true, schoolId: true },
    });
    if (!year) throw new NotFoundException('Año escolar no encontrado.');
    this.permissions.ensureCanAccessSchool(user, year.schoolId);
    return year;
  }

  private toResponse(
    schoolId: string,
    schoolYearId: string,
    control: AcademicPeriodControl | null,
  ) {
    return {
      schoolId,
      schoolYearId,
      fields: Object.fromEntries(
        ACADEMIC_PERIOD_FIELDS.map((field) => [field, control?.[`${field}Open`] ?? true]),
      ),
      updatedAt: control?.updatedAt ?? null,
      updatedBy: control?.updatedBy ?? null,
    };
  }
}
