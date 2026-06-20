import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubjectType, UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTechnicalLearningOutcomeDto } from './dto/create-technical-learning-outcome.dto';
import { UpdateTechnicalLearningOutcomeDto } from './dto/update-technical-learning-outcome.dto';

@Injectable()
export class TechnicalLearningOutcomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTechnicalLearningOutcomeDto, user: AuthenticatedUser) {
    await this.validateTechnicalSubject(dto.subjectId, dto.schoolId, user);
    await this.validateActiveWeightLimit(dto.schoolId, dto.subjectId, dto.weight);

    try {
      const learningOutcome = await this.prisma.technicalLearningOutcome.create({
        data: {
          ...dto,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      await this.auditService.logCreate({
        schoolId: learningOutcome.schoolId,
        userId: user.id,
        entity: 'TechnicalLearningOutcome',
        entityId: learningOutcome.id,
        newValue: learningOutcome,
      });

      return learningOutcome;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async findBySubject(subjectId: string, user: AuthenticatedUser) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });

    if (!subject || subject.type !== SubjectType.TECHNICAL) {
      throw new NotFoundException('Technical subject not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, subject.schoolId);

    if (user.role === UserRole.TEACHER) {
      const assignment = await this.prisma.teacherAssignment.findFirst({
        where: {
          schoolId: subject.schoolId,
          subjectId,
          teacherId: user.teacherId ?? '',
          isActive: true,
        },
        select: { id: true },
      });

      if (!assignment) {
        throw new NotFoundException('Technical subject not found.');
      }
    }

    return this.prisma.technicalLearningOutcome.findMany({
      where: { subjectId, schoolId: subject.schoolId },
      orderBy: { order: 'asc' },
    });
  }

  async update(id: string, dto: UpdateTechnicalLearningOutcomeDto, user: AuthenticatedUser) {
    const current = await this.findAccessibleById(id, user);
    const nextIsActive = dto.isActive ?? current.isActive;

    if (nextIsActive) {
      await this.validateActiveWeightLimit(
        current.schoolId,
        current.subjectId,
        dto.weight ?? this.toNumber(current.weight),
        id,
      );
    }

    try {
      const learningOutcome = await this.prisma.technicalLearningOutcome.update({
        where: { id },
        data: {
          ...dto,
          updatedBy: user.id,
        },
      });
      await this.auditService.logUpdate({
        schoolId: learningOutcome.schoolId,
        userId: user.id,
        entity: 'TechnicalLearningOutcome',
        entityId: learningOutcome.id,
        oldValue: current,
        newValue: learningOutcome,
      });

      return learningOutcome;
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    const oldValue = await this.findAccessibleById(id, user);

    const learningOutcome = await this.prisma.technicalLearningOutcome.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: user.id,
      },
    });
    await this.auditService.logDelete({
      schoolId: learningOutcome.schoolId,
      userId: user.id,
      entity: 'TechnicalLearningOutcome',
      entityId: learningOutcome.id,
      oldValue,
    });

    return learningOutcome;
  }

  private async findAccessibleById(id: string, user: AuthenticatedUser) {
    const learningOutcome = await this.prisma.technicalLearningOutcome.findUnique({
      where: { id },
    });

    if (!learningOutcome) {
      throw new NotFoundException('Technical learning outcome not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, learningOutcome.schoolId);
    return learningOutcome;
  }

  private async validateTechnicalSubject(
    subjectId: string,
    schoolId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    this.permissionsService.ensureCanAccessSchool(user, schoolId);

    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
        type: SubjectType.TECHNICAL,
        isActive: true,
      },
      select: { id: true },
    });

    if (!subject) {
      throw new BadRequestException('Subject must be an active technical subject.');
    }
  }

  private async validateActiveWeightLimit(
    schoolId: string,
    subjectId: string,
    weight: number,
    excludeId?: string,
  ): Promise<void> {
    const activeOutcomes = await this.prisma.technicalLearningOutcome.findMany({
      where: {
        schoolId,
        subjectId,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { weight: true },
    });

    const total = activeOutcomes.reduce((sum, outcome) => sum + this.toNumber(outcome.weight), 0);

    if (total + weight > 100) {
      throw new BadRequestException('Active learning outcome weights cannot exceed 100.');
    }
  }

  private toNumber(value: Prisma.Decimal | number | string): number {
    return Number(value);
  }
}
