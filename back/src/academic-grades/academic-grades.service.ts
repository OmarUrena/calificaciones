import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubjectStatus, SubjectType, UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicFinalEvaluationDto } from './dto/academic-final-evaluation.dto';
import { BulkAcademicGradesDto } from './dto/bulk-academic-grades.dto';
import { CreateAcademicGradeDto } from './dto/create-academic-grade.dto';
import { UpdateAcademicGradeDto } from './dto/update-academic-grade.dto';

type AcademicScoreFields = {
  p1?: number | null;
  rp1?: number | null;
  p2?: number | null;
  rp2?: number | null;
  p3?: number | null;
  rp3?: number | null;
  p4?: number | null;
  rp4?: number | null;
};

type PersistedAcademicScoreFields = {
  p1?: Prisma.Decimal | number | string | null;
  rp1?: Prisma.Decimal | number | string | null;
  p2?: Prisma.Decimal | number | string | null;
  rp2?: Prisma.Decimal | number | string | null;
  p3?: Prisma.Decimal | number | string | null;
  rp3?: Prisma.Decimal | number | string | null;
  p4?: Prisma.Decimal | number | string | null;
  rp4?: Prisma.Decimal | number | string | null;
};

type AcademicContext = {
  schoolId: string;
  schoolYearId: string;
  courseId: string;
  studentId: string;
  subjectId: string;
};

@Injectable()
export class AcademicGradesService {
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

    await this.validateAcademicSubjectForCourse(
      {
        schoolId: course.schoolId,
        schoolYearId: course.schoolYearId,
        courseId,
        subjectId,
      },
      user,
    );

    return this.prisma.academicGrade.findMany({
      where: {
        schoolId: course.schoolId,
        schoolYearId: course.schoolYearId,
        courseId,
        subjectId,
      },
      include: {
        student: true,
        subject: true,
      },
      orderBy: [{ student: { listNumber: 'asc' } }, { blockNumber: 'asc' }],
    });
  }

  async create(dto: CreateAcademicGradeDto, user: AuthenticatedUser) {
    const context = await this.validateCreateContext(dto, user);
    const pc = this.calculatePc(dto);

    try {
      const grade = await this.prisma.academicGrade.create({
        data: {
          ...dto,
          pc,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      const result = await this.recalculateResult(context, user.id);
      await this.auditService.logCreate({
        schoolId: grade.schoolId,
        userId: user.id,
        entity: 'AcademicGrade',
        entityId: grade.id,
        newValue: { grade, result },
      });

      return { grade, result };
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateAcademicGradeDto, user: AuthenticatedUser) {
    const current = await this.prisma.academicGrade.findUnique({ where: { id } });

    if (!current) {
      throw new NotFoundException('Academic grade not found.');
    }

    const context: AcademicContext = {
      schoolId: current.schoolId,
      schoolYearId: current.schoolYearId,
      courseId: current.courseId,
      studentId: current.studentId,
      subjectId: current.subjectId,
    };

    await this.validateAcademicSubjectForCourse(context, user);

    const mergedScores = this.mergeScores(current, dto);
    const pc = this.calculatePc(mergedScores);

    const grade = await this.prisma.academicGrade.update({
      where: { id },
      data: {
        ...dto,
        pc,
        updatedBy: user.id,
      },
    });
    const result = await this.recalculateResult(context, user.id);
    await this.auditService.logUpdate({
      schoolId: grade.schoolId,
      userId: user.id,
      entity: 'AcademicGrade',
      entityId: grade.id,
      oldValue: current,
      newValue: { grade, result },
    });

    return { grade, result };
  }

  async bulk(dto: BulkAcademicGradesDto, user: AuthenticatedUser) {
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

  async finalEvaluations(dto: AcademicFinalEvaluationDto, user: AuthenticatedUser) {
    const context = await this.getContextByStudentAndSubject(dto.studentId, dto.subjectId, user);
    const current = await this.recalculateResult(context, user.id);
    const cf = current.cf;

    if (cf === null) {
      throw new BadRequestException('Cannot register final evaluations before CF is available.');
    }

    if (dto.ce !== undefined && cf + dto.ce > 100) {
      throw new BadRequestException('CF + CE cannot be greater than 100.');
    }

    const computed = this.computeSubjectResult({
      cf,
      cec: dto.cec ?? current.cec,
      ceex: dto.ceex ?? current.ceex,
      ce: dto.ce ?? current.ce,
    });

    const oldValue = current;
    const result = await this.prisma.academicSubjectResult.update({
      where: {
        schoolId_schoolYearId_studentId_subjectId: {
          schoolId: context.schoolId,
          schoolYearId: context.schoolYearId,
          studentId: context.studentId,
          subjectId: context.subjectId,
        },
      },
      data: {
        cec: dto.cec ?? current.cec,
        ceex: dto.ceex ?? current.ceex,
        ce: dto.ce ?? current.ce,
        ccf: computed.ccf,
        cexf: computed.cexf,
        cef: computed.cef,
        status: computed.status,
        updatedBy: user.id,
      },
    });
    await this.auditService.logUpdate({
      schoolId: result.schoolId,
      userId: user.id,
      entity: 'AcademicSubjectResult',
      entityId: result.id,
      oldValue,
      newValue: result,
    });

    return result;
  }

  async evaluateSpecialRight(studentId: string, user: AuthenticatedUser) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, student.schoolId);

    const failedExtraordinaryResults = await this.prisma.academicSubjectResult.findMany({
      where: {
        schoolId: student.schoolId,
        schoolYearId: student.schoolYearId,
        studentId,
        cexf: { lt: 70 },
      },
      select: { id: true },
    });

    const status =
      failedExtraordinaryResults.length > 2 ? SubjectStatus.FAILED : SubjectStatus.SPECIAL;

    await this.prisma.academicSubjectResult.updateMany({
      where: {
        id: { in: failedExtraordinaryResults.map((result) => result.id) },
      },
      data: {
        status,
        updatedBy: user.id,
      },
    });
    await this.auditService.logUpdate({
      schoolId: student.schoolId,
      userId: user.id,
      entity: 'AcademicSubjectResult',
      entityId: studentId,
      oldValue: { failedExtraordinarySubjects: failedExtraordinaryResults.length },
      newValue: { status },
    });

    return {
      studentId,
      failedExtraordinarySubjects: failedExtraordinaryResults.length,
      status,
    };
  }

  private async validateCreateContext(
    dto: CreateAcademicGradeDto,
    user: AuthenticatedUser,
  ): Promise<AcademicContext> {
    this.validateScoreRules(dto);

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

    const context: AcademicContext = {
      schoolId: dto.schoolId,
      schoolYearId: dto.schoolYearId,
      courseId: dto.courseId,
      studentId: dto.studentId,
      subjectId: dto.subjectId,
    };

    await this.validateAcademicSubjectForCourse(context, user);
    return context;
  }

  private async validateAcademicSubjectForCourse(
    context: Omit<AcademicContext, 'studentId'>,
    user: AuthenticatedUser,
  ): Promise<void> {
    this.permissionsService.ensureCanAccessSchool(user, context.schoolId);

    const subject = await this.prisma.subject.findFirst({
      where: {
        id: context.subjectId,
        schoolId: context.schoolId,
        type: SubjectType.ACADEMIC,
        isActive: true,
      },
      select: { id: true },
    });

    if (!subject) {
      throw new BadRequestException(
        'Subject must be an active academic subject in the same school.',
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
  }

  private async getContextByStudentAndSubject(
    studentId: string,
    subjectId: string,
    user: AuthenticatedUser,
  ): Promise<AcademicContext> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    const context: AcademicContext = {
      schoolId: student.schoolId,
      schoolYearId: student.schoolYearId,
      courseId: student.courseId,
      studentId,
      subjectId,
    };

    await this.validateAcademicSubjectForCourse(context, user);
    return context;
  }

  private async recalculateResult(context: AcademicContext, userId: string) {
    const grades = await this.prisma.academicGrade.findMany({
      where: {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        studentId: context.studentId,
        subjectId: context.subjectId,
      },
      orderBy: { blockNumber: 'asc' },
    });

    const pcByBlock = new Map<number, number | null>();

    for (const grade of grades) {
      pcByBlock.set(grade.blockNumber, this.toNumber(grade.pc));
    }

    const pc1 = pcByBlock.get(1) ?? null;
    const pc2 = pcByBlock.get(2) ?? null;
    const pc3 = pcByBlock.get(3) ?? null;
    const pc4 = pcByBlock.get(4) ?? null;
    const pcs = [pc1, pc2, pc3, pc4];
    const cf = pcs.every((pc): pc is number => pc !== null)
      ? this.roundInteger(this.average(pcs))
      : null;

    const current = await this.prisma.academicSubjectResult.findUnique({
      where: {
        schoolId_schoolYearId_studentId_subjectId: {
          schoolId: context.schoolId,
          schoolYearId: context.schoolYearId,
          studentId: context.studentId,
          subjectId: context.subjectId,
        },
      },
    });

    const computed = this.computeSubjectResult({
      cf,
      cec: current?.cec ?? null,
      ceex: current?.ceex ?? null,
      ce: current?.ce ?? null,
    });

    return this.prisma.academicSubjectResult.upsert({
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
        pc1,
        pc2,
        pc3,
        pc4,
        cf,
        ccf: computed.ccf,
        cexf: computed.cexf,
        cef: computed.cef,
        status: computed.status,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        pc1,
        pc2,
        pc3,
        pc4,
        cf,
        ccf: computed.ccf,
        cexf: computed.cexf,
        cef: computed.cef,
        status: computed.status,
        updatedBy: userId,
      },
    });
  }

  private computeSubjectResult(params: {
    cf: number | null;
    cec?: number | null;
    ceex?: number | null;
    ce?: number | null;
  }): { ccf: number | null; cexf: number | null; cef: number | null; status: SubjectStatus } {
    const { cf, cec, ceex, ce } = params;

    if (cf === null) {
      return { ccf: null, cexf: null, cef: null, status: SubjectStatus.PENDING };
    }

    let status: SubjectStatus = cf >= 70 ? SubjectStatus.APPROVED : SubjectStatus.COMPLETIVA;
    let ccf: number | null = null;
    let cexf: number | null = null;
    let cef: number | null = null;

    if (cf < 70 && cec !== null && cec !== undefined) {
      ccf = this.roundInteger(cf * 0.5 + cec * 0.5);
      status = ccf >= 70 ? SubjectStatus.APPROVED : SubjectStatus.EXTRAORDINARIA;
    }

    if (cf < 70 && ccf !== null && ccf < 70 && ceex !== null && ceex !== undefined) {
      cexf = this.roundInteger(cf * 0.3 + ceex * 0.7);
      status = cexf >= 70 ? SubjectStatus.APPROVED : SubjectStatus.SPECIAL;
    }

    if (cf < 70 && ce !== null && ce !== undefined) {
      if (cf + ce > 100) {
        throw new BadRequestException('CF + CE cannot be greater than 100.');
      }

      cef = cf + ce;
      status = cef >= 70 ? SubjectStatus.APPROVED : SubjectStatus.FAILED;
    }

    return { ccf, cexf, cef, status };
  }

  private calculatePc(scores: AcademicScoreFields): number | null {
    this.validateScoreRules(scores);

    const validScores = [
      this.getValidScore(scores.p1, scores.rp1),
      this.getValidScore(scores.p2, scores.rp2),
      this.getValidScore(scores.p3, scores.rp3),
      this.getValidScore(scores.p4, scores.rp4),
    ];

    if (validScores.some((score) => score === null)) {
      return null;
    }

    return this.roundOneDecimal(this.average(validScores as number[]));
  }

  private validateScoreRules(scores: AcademicScoreFields): void {
    this.validateRecovery('RP1', scores.p1, scores.rp1);
    this.validateRecovery('RP2', scores.p2, scores.rp2);
    this.validateRecovery('RP3', scores.p3, scores.rp3);
    this.validateRecovery('RP4', scores.p4, scores.rp4);
  }

  private validateRecovery(
    label: string,
    ordinary?: number | null,
    recovery?: number | null,
  ): void {
    if (recovery === null || recovery === undefined) {
      return;
    }

    if (ordinary === null || ordinary === undefined) {
      throw new BadRequestException(`${label} requires its ordinary grade.`);
    }

    if (ordinary >= 70) {
      throw new BadRequestException(`${label} only applies when the ordinary grade is below 70.`);
    }

    if (recovery < ordinary) {
      throw new BadRequestException(`${label} cannot be lower than its ordinary grade.`);
    }
  }

  private getValidScore(ordinary?: number | null, recovery?: number | null): number | null {
    if (ordinary === null || ordinary === undefined) {
      return null;
    }

    return recovery ?? ordinary;
  }

  private mergeScores(
    current: PersistedAcademicScoreFields,
    dto: UpdateAcademicGradeDto,
  ): AcademicScoreFields {
    return {
      p1: dto.p1 ?? this.toNumber(current.p1),
      rp1: dto.rp1 ?? this.toNumber(current.rp1),
      p2: dto.p2 ?? this.toNumber(current.p2),
      rp2: dto.rp2 ?? this.toNumber(current.rp2),
      p3: dto.p3 ?? this.toNumber(current.p3),
      rp3: dto.rp3 ?? this.toNumber(current.rp3),
      p4: dto.p4 ?? this.toNumber(current.p4),
      rp4: dto.rp4 ?? this.toNumber(current.rp4),
    };
  }

  private average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private roundOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private roundInteger(value: number): number {
    return Math.round(value);
  }

  private toNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(value);
  }
}
