import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubjectStatus, SubjectType, UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { BulkTechnicalGradesDto } from './dto/bulk-technical-grades.dto';
import { CreateTechnicalGradeDto } from './dto/create-technical-grade.dto';
import { UpdateTechnicalGradeDto } from './dto/update-technical-grade.dto';

type TechnicalScoreFields = {
  ordinaryScore?: number | null;
  recovery1Score?: number | null;
  recovery2Score?: number | null;
  specialScore?: number | null;
};

type PersistedTechnicalScoreFields = {
  ordinaryScore?: Prisma.Decimal | number | string | null;
  recovery1Score?: Prisma.Decimal | number | string | null;
  recovery2Score?: Prisma.Decimal | number | string | null;
  specialScore?: Prisma.Decimal | number | string | null;
};

type TechnicalContext = {
  schoolId: string;
  schoolYearId: string;
  courseId: string;
  studentId: string;
  subjectId: string;
};

type CandidateGrade = TechnicalContext & {
  id?: string;
  learningOutcomeId: string;
  scores: TechnicalScoreFields;
};

@Injectable()
export class TechnicalGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async findByCourseAndSubject(courseId: string, subjectId: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    await this.validateTechnicalSubjectForCourse(
      {
        schoolId: course.schoolId,
        schoolYearId: course.schoolYearId,
        courseId,
        subjectId,
      },
      user,
    );

    return this.prisma.technicalGrade.findMany({
      where: {
        schoolId: course.schoolId,
        schoolYearId: course.schoolYearId,
        courseId,
        subjectId,
      },
      include: {
        student: true,
        subject: true,
        learningOutcome: true,
      },
      orderBy: [{ student: { listNumber: 'asc' } }, { learningOutcome: { order: 'asc' } }],
    });
  }

  async create(dto: CreateTechnicalGradeDto, user: AuthenticatedUser) {
    const context = await this.validateCreateContext(dto, user);
    const learningOutcome = await this.getLearningOutcome(dto.learningOutcomeId, context.subjectId);
    const scores = this.toTechnicalScores(dto);

    await this.validateScores({
      context,
      learningOutcomeId: dto.learningOutcomeId,
      scores,
      weight: this.toNumber(learningOutcome.weight),
    });

    try {
      const grade = await this.prisma.technicalGrade.create({
        data: {
          ...dto,
          validScore: this.getValidScore(scores),
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      const result = await this.recalculateResult(context, user.id);
      await this.auditService.logCreate({
        schoolId: grade.schoolId,
        userId: user.id,
        entity: 'TechnicalGrade',
        entityId: grade.id,
        newValue: { grade, result },
      });

      return { grade, result };
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateTechnicalGradeDto, user: AuthenticatedUser) {
    const current = await this.prisma.technicalGrade.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException('Technical grade not found.');
    }

    const context: TechnicalContext = {
      schoolId: current.schoolId,
      schoolYearId: current.schoolYearId,
      courseId: current.courseId,
      studentId: current.studentId,
      subjectId: current.subjectId,
    };

    await this.validateTechnicalSubjectForCourse(context, user);

    const learningOutcome = await this.getLearningOutcome(
      current.learningOutcomeId,
      current.subjectId,
    );
    const scores = this.mergeScores(current, dto);

    await this.validateScores({
      context,
      gradeId: id,
      learningOutcomeId: current.learningOutcomeId,
      scores,
      weight: this.toNumber(learningOutcome.weight),
    });

    const grade = await this.prisma.technicalGrade.update({
      where: { id },
      data: {
        ...dto,
        validScore: this.getValidScore(scores),
        updatedBy: user.id,
      },
    });
    const result = await this.recalculateResult(context, user.id);
    await this.auditService.logUpdate({
      schoolId: grade.schoolId,
      userId: user.id,
      entity: 'TechnicalGrade',
      entityId: grade.id,
      oldValue: current,
      newValue: { grade, result },
    });

    return { grade, result };
  }

  async bulk(dto: BulkTechnicalGradesDto, user: AuthenticatedUser) {
    const items = [];

    for (const gradeDto of dto.grades) {
      items.push(await this.create(gradeDto, user));
    }

    return {
      totalRows: dto.grades.length,
      successRows: items.length,
      items,
    };
  }

  async recalculate(studentId: string, subjectId: string, user: AuthenticatedUser) {
    const context = await this.getContextByStudentAndSubject(studentId, subjectId, user);
    return this.recalculateResult(context, user.id);
  }

  private async validateCreateContext(
    dto: CreateTechnicalGradeDto,
    user: AuthenticatedUser,
  ): Promise<TechnicalContext> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: dto.studentId,
        schoolId: dto.schoolId,
        schoolYearId: dto.schoolYearId,
        courseId: dto.courseId,
      },
      select: { id: true },
    });

    if (!student) {
      throw new BadRequestException('Student must belong to the same school, year and course.');
    }

    const context: TechnicalContext = {
      schoolId: dto.schoolId,
      schoolYearId: dto.schoolYearId,
      courseId: dto.courseId,
      studentId: dto.studentId,
      subjectId: dto.subjectId,
    };

    await this.validateTechnicalSubjectForCourse(context, user);
    return context;
  }

  private async validateTechnicalSubjectForCourse(
    context: Omit<TechnicalContext, 'studentId'>,
    user: AuthenticatedUser,
  ): Promise<void> {
    this.permissionsService.ensureCanAccessSchool(user, context.schoolId);

    const subject = await this.prisma.subject.findFirst({
      where: {
        id: context.subjectId,
        schoolId: context.schoolId,
        type: SubjectType.TECHNICAL,
        isActive: true,
      },
      select: { id: true },
    });

    if (!subject) {
      throw new BadRequestException(
        'Subject must be an active technical subject in the same school.',
      );
    }

    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        courseId: context.courseId,
        subjectId: context.subjectId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new BadRequestException('Subject must be assigned to the course and school year.');
    }

    if (user.role === UserRole.TEACHER) {
      await this.permissionsService.ensureTeacherCanManageSubject({
        user,
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        courseId: context.courseId,
        subjectId: context.subjectId,
      });
    }

    await this.ensureLearningOutcomeWeightsAreComplete(context.schoolId, context.subjectId);
  }

  private async getContextByStudentAndSubject(
    studentId: string,
    subjectId: string,
    user: AuthenticatedUser,
  ): Promise<TechnicalContext> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    const context: TechnicalContext = {
      schoolId: student.schoolId,
      schoolYearId: student.schoolYearId,
      courseId: student.courseId,
      studentId,
      subjectId,
    };

    await this.validateTechnicalSubjectForCourse(context, user);
    return context;
  }

  private async getLearningOutcome(learningOutcomeId: string, subjectId: string) {
    const learningOutcome = await this.prisma.technicalLearningOutcome.findFirst({
      where: {
        id: learningOutcomeId,
        subjectId,
        isActive: true,
      },
    });

    if (!learningOutcome) {
      throw new BadRequestException('Learning outcome must belong to the technical subject.');
    }

    return learningOutcome;
  }

  private async ensureLearningOutcomeWeightsAreComplete(
    schoolId: string,
    subjectId: string,
  ): Promise<void> {
    const learningOutcomes = await this.prisma.technicalLearningOutcome.findMany({
      where: { schoolId, subjectId, isActive: true },
      select: { weight: true },
    });

    const totalWeight = learningOutcomes.reduce(
      (sum, learningOutcome) => sum + this.toNumber(learningOutcome.weight),
      0,
    );

    if (Math.abs(totalWeight - 100) > 0.001) {
      throw new BadRequestException('Active learning outcome weights must add up to 100.');
    }
  }

  private async validateScores(params: {
    context: TechnicalContext;
    gradeId?: string;
    learningOutcomeId: string;
    scores: TechnicalScoreFields;
    weight: number;
  }): Promise<void> {
    const { context, gradeId, learningOutcomeId, scores, weight } = params;

    this.validateScoreRange('ordinaryScore', scores.ordinaryScore, weight);
    this.validateScoreRange('recovery1Score', scores.recovery1Score, weight);
    this.validateScoreRange('recovery2Score', scores.recovery2Score, weight);
    this.validateScoreRange('specialScore', scores.specialScore, weight);
    this.validateRecoverySequence(scores);

    if (scores.specialScore === null || scores.specialScore === undefined) {
      return;
    }

    const validBeforeSpecial = this.getValidScoreWithoutSpecial(scores);

    if (validBeforeSpecial === null) {
      throw new BadRequestException('Special score requires a previous RA score.');
    }

    const minimum = weight * 0.7;

    if (validBeforeSpecial >= minimum) {
      throw new BadRequestException('Special score only applies to non-approved RAs.');
    }

    const totalBeforeSpecial = await this.calculateTotalBeforeSpecial({
      context,
      candidate: {
        ...context,
        id: gradeId,
        learningOutcomeId,
        scores,
      },
    });

    if (totalBeforeSpecial >= 70) {
      throw new BadRequestException(
        'Special technical evaluation only applies when module total is below 70.',
      );
    }
  }

  private validateScoreRange(
    label: string,
    score: number | null | undefined,
    weight: number,
  ): void {
    if (score === null || score === undefined) {
      return;
    }

    if (score > weight) {
      throw new BadRequestException(`${label} cannot be greater than the RA weight.`);
    }
  }

  private validateRecoverySequence(scores: TechnicalScoreFields): void {
    if (scores.recovery1Score !== null && scores.recovery1Score !== undefined) {
      if (scores.ordinaryScore === null || scores.ordinaryScore === undefined) {
        throw new BadRequestException('recovery1Score requires ordinaryScore.');
      }

      if (scores.recovery1Score < scores.ordinaryScore) {
        throw new BadRequestException('recovery1Score cannot be lower than ordinaryScore.');
      }
    }

    if (scores.recovery2Score !== null && scores.recovery2Score !== undefined) {
      if (scores.recovery1Score === null || scores.recovery1Score === undefined) {
        throw new BadRequestException('recovery2Score requires recovery1Score.');
      }

      if (scores.recovery2Score < scores.recovery1Score) {
        throw new BadRequestException('recovery2Score cannot be lower than recovery1Score.');
      }
    }
  }

  private async calculateTotalBeforeSpecial(params: {
    context: TechnicalContext;
    candidate: CandidateGrade;
  }): Promise<number> {
    const grades = await this.prisma.technicalGrade.findMany({
      where: {
        schoolId: params.context.schoolId,
        schoolYearId: params.context.schoolYearId,
        studentId: params.context.studentId,
        subjectId: params.context.subjectId,
        ...(params.candidate.id ? { id: { not: params.candidate.id } } : {}),
      },
    });

    const total = grades.reduce(
      (sum, grade) => sum + (this.getValidScoreWithoutSpecial(this.persistedToScores(grade)) ?? 0),
      0,
    );

    return total + (this.getValidScoreWithoutSpecial(params.candidate.scores) ?? 0);
  }

  private async recalculateResult(context: TechnicalContext, userId: string) {
    const learningOutcomes = await this.prisma.technicalLearningOutcome.findMany({
      where: {
        schoolId: context.schoolId,
        subjectId: context.subjectId,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });

    const grades = await this.prisma.technicalGrade.findMany({
      where: {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        studentId: context.studentId,
        subjectId: context.subjectId,
      },
    });

    const gradesByLearningOutcome = new Map(
      grades.map((grade) => [grade.learningOutcomeId, grade]),
    );
    const hasAllScores = learningOutcomes.every((learningOutcome) => {
      const grade = gradesByLearningOutcome.get(learningOutcome.id);
      return Boolean(grade && grade.validScore !== null);
    });
    const totalScore = learningOutcomes.reduce((sum, learningOutcome) => {
      const grade = gradesByLearningOutcome.get(learningOutcome.id);
      return sum + (grade ? (this.toNullableNumber(grade.validScore) ?? 0) : 0);
    }, 0);
    const hasSpecialScores = grades.some((grade) => grade.specialScore !== null);
    const status = this.resolveTechnicalStatus(hasAllScores, totalScore, hasSpecialScores);

    return this.prisma.technicalSubjectResult.upsert({
      where: {
        schoolId_schoolYearId_studentId_subjectId: {
          schoolId: context.schoolId,
          schoolYearId: context.schoolYearId,
          studentId: context.studentId,
          subjectId: context.subjectId,
        },
      },
      create: {
        ...context,
        totalScore,
        finalScore: Math.round(totalScore),
        status,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        totalScore,
        finalScore: Math.round(totalScore),
        status,
        updatedBy: userId,
      },
    });
  }

  private resolveTechnicalStatus(
    hasAllScores: boolean,
    totalScore: number,
    hasSpecialScores: boolean,
  ): SubjectStatus {
    if (!hasAllScores) {
      return SubjectStatus.PENDING;
    }

    if (totalScore >= 70) {
      return SubjectStatus.APPROVED;
    }

    return hasSpecialScores ? SubjectStatus.FAILED : SubjectStatus.SPECIAL;
  }

  private getValidScore(scores: TechnicalScoreFields): number | null {
    return (
      scores.specialScore ??
      scores.recovery2Score ??
      scores.recovery1Score ??
      scores.ordinaryScore ??
      null
    );
  }

  private getValidScoreWithoutSpecial(scores: TechnicalScoreFields): number | null {
    return scores.recovery2Score ?? scores.recovery1Score ?? scores.ordinaryScore ?? null;
  }

  private toTechnicalScores(dto: CreateTechnicalGradeDto): TechnicalScoreFields {
    return {
      ordinaryScore: dto.ordinaryScore,
      recovery1Score: dto.recovery1Score,
      recovery2Score: dto.recovery2Score,
      specialScore: dto.specialScore,
    };
  }

  private mergeScores(
    current: PersistedTechnicalScoreFields,
    dto: UpdateTechnicalGradeDto,
  ): TechnicalScoreFields {
    return {
      ordinaryScore: dto.ordinaryScore ?? this.toNullableNumber(current.ordinaryScore),
      recovery1Score: dto.recovery1Score ?? this.toNullableNumber(current.recovery1Score),
      recovery2Score: dto.recovery2Score ?? this.toNullableNumber(current.recovery2Score),
      specialScore: dto.specialScore ?? this.toNullableNumber(current.specialScore),
    };
  }

  private persistedToScores(scores: PersistedTechnicalScoreFields): TechnicalScoreFields {
    return {
      ordinaryScore: this.toNullableNumber(scores.ordinaryScore),
      recovery1Score: this.toNullableNumber(scores.recovery1Score),
      recovery2Score: this.toNullableNumber(scores.recovery2Score),
      specialScore: this.toNullableNumber(scores.specialScore),
    };
  }

  private toNumber(value: Prisma.Decimal | number | string): number {
    return Number(value);
  }

  private toNullableNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(value);
  }
}
