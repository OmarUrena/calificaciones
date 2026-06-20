import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportStatus, ImportType, Prisma, SubjectType, UserRole } from '@prisma/client';
import { Workbook } from 'exceljs';

import { AcademicGradesService } from '../academic-grades/academic-grades.service';
import { CreateAcademicGradeDto } from '../academic-grades/dto/create-academic-grade.dto';
import { UpdateAcademicGradeDto } from '../academic-grades/dto/update-academic-grade.dto';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTechnicalGradeDto } from '../technical-grades/dto/create-technical-grade.dto';
import { UpdateTechnicalGradeDto } from '../technical-grades/dto/update-technical-grade.dto';
import { TechnicalGradesService } from '../technical-grades/technical-grades.service';
import { ImportGradesDto } from './dto/import-grades.dto';
import { ImportStudentsDto } from './dto/import-students.dto';
import { UploadedExcelFile } from './types/uploaded-excel-file.type';

type ImportRow = Record<string, string | number | null>;

type ImportContext = {
  schoolId: string;
  schoolYearId: string;
  courseId?: string;
};

type ImportSummary = {
  jobId: string;
  status: ImportStatus;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: string[];
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly academicGradesService: AcademicGradesService,
    private readonly technicalGradesService: TechnicalGradesService,
    private readonly auditService: AuditService,
  ) {}

  async importStudents(
    file: UploadedExcelFile,
    dto: ImportStudentsDto,
    user: AuthenticatedUser,
  ): Promise<ImportSummary> {
    const context = await this.resolveSchoolYearContext(dto.schoolYearId, user);
    const rows = await this.readRows(file);
    const job = await this.createJob({
      type: ImportType.STUDENTS,
      file,
      user,
      context,
      totalRows: rows.length,
    });
    const errors: string[] = [];
    let successRows = 0;

    for (const row of rows) {
      try {
        await this.importStudentRow(row, context, user.id);
        successRows += 1;
      } catch (error) {
        errors.push(this.formatRowError(row, error));
      }
    }

    return this.finishJob(job.id, context.schoolId, user.id, rows.length, successRows, errors);
  }

  async importAcademicGrades(
    file: UploadedExcelFile,
    dto: ImportGradesDto,
    user: AuthenticatedUser,
  ): Promise<ImportSummary> {
    const context = await this.resolveCourseContext(dto.schoolYearId, dto.courseId, user);
    const rows = await this.readRows(file);
    const job = await this.createJob({
      type: ImportType.ACADEMIC_GRADES,
      file,
      user,
      context,
      totalRows: rows.length,
    });
    const errors: string[] = [];
    let successRows = 0;

    for (const row of rows) {
      try {
        await this.importAcademicGradeRow(row, context, user);
        successRows += 1;
      } catch (error) {
        errors.push(this.formatRowError(row, error));
      }
    }

    return this.finishJob(job.id, context.schoolId, user.id, rows.length, successRows, errors);
  }

  async importTechnicalGrades(
    file: UploadedExcelFile,
    dto: ImportGradesDto,
    user: AuthenticatedUser,
  ): Promise<ImportSummary> {
    const context = await this.resolveCourseContext(dto.schoolYearId, dto.courseId, user);
    const rows = await this.readRows(file);
    const job = await this.createJob({
      type: ImportType.TECHNICAL_GRADES,
      file,
      user,
      context,
      totalRows: rows.length,
    });
    const errors: string[] = [];
    let successRows = 0;

    for (const row of rows) {
      try {
        await this.importTechnicalGradeRow(row, context, user);
        successRows += 1;
      } catch (error) {
        errors.push(this.formatRowError(row, error));
      }
    }

    return this.finishJob(job.id, context.schoolId, user.id, rows.length, successRows, errors);
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.importJob.findMany({
      where:
        user.role === UserRole.SUPER_ADMIN
          ? undefined
          : {
              schoolId: user.schoolId ?? '',
              ...(user.role === UserRole.TEACHER ? { userId: user.id } : {}),
            },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });

    if (!job) {
      throw new NotFoundException('Import job not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, job.schoolId);

    if (user.role === UserRole.TEACHER && job.userId !== user.id) {
      throw new NotFoundException('Import job not found.');
    }

    return job;
  }

  private async importStudentRow(
    row: ImportRow,
    context: ImportContext,
    userId: string,
  ): Promise<void> {
    const listNumber = this.requiredNumber(row, 'numero_lista');
    const firstName = this.requiredString(row, 'nombres');
    const lastName = this.requiredString(row, 'apellidos');
    const courseValue = this.requiredString(row, 'curso');
    const course = await this.prisma.course.findFirst({
      where: {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        OR: [{ id: courseValue }, { name: courseValue }],
      },
      select: { id: true },
    });

    if (!course) {
      throw new BadRequestException('Curso no existe.');
    }

    try {
      await this.prisma.student.create({
        data: {
          schoolId: context.schoolId,
          schoolYearId: context.schoolYearId,
          courseId: course.id,
          listNumber,
          firstName,
          lastName,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    } catch (error) {
      this.rethrowImportPrismaError(error, 'numero_lista ya existe en el curso.');
    }
  }

  private async importAcademicGradeRow(
    row: ImportRow,
    context: ImportContext,
    user: AuthenticatedUser,
  ): Promise<void> {
    const student = await this.findStudentByListNumber(row, context);
    const subject = await this.findSubjectByName(row, context.schoolId, SubjectType.ACADEMIC);
    let importedBlocks = 0;

    for (const blockNumber of [1, 2, 3, 4]) {
      const gradeDto = this.buildAcademicGradeDto(
        row,
        context,
        student.id,
        subject.id,
        blockNumber,
      );

      if (!this.hasAcademicScores(gradeDto)) {
        continue;
      }

      const existing = await this.prisma.academicGrade.findUnique({
        where: {
          schoolId_schoolYearId_studentId_subjectId_blockNumber: {
            schoolId: context.schoolId,
            schoolYearId: context.schoolYearId,
            studentId: student.id,
            subjectId: subject.id,
            blockNumber,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await this.academicGradesService.update(
          existing.id,
          this.toAcademicUpdateDto(gradeDto),
          user,
        );
      } else {
        await this.academicGradesService.create(gradeDto, user);
      }

      importedBlocks += 1;
    }

    if (importedBlocks === 0) {
      throw new BadRequestException('No academic grade columns were provided.');
    }

    const cec = this.optionalNumber(row, 'cec');
    const ceex = this.optionalNumber(row, 'ceex');
    const ce = this.optionalNumber(row, 'ce');

    if (cec !== undefined || ceex !== undefined || ce !== undefined) {
      await this.academicGradesService.finalEvaluations(
        {
          studentId: student.id,
          subjectId: subject.id,
          cec,
          ceex,
          ce,
        },
        user,
      );
    }
  }

  private async importTechnicalGradeRow(
    row: ImportRow,
    context: ImportContext,
    user: AuthenticatedUser,
  ): Promise<void> {
    const student = await this.findStudentByListNumber(row, context);
    const subject = await this.findSubjectByName(
      row,
      context.schoolId,
      SubjectType.TECHNICAL,
      'modulo',
    );
    const learningOutcomes = await this.prisma.technicalLearningOutcome.findMany({
      where: { schoolId: context.schoolId, subjectId: subject.id, isActive: true },
      orderBy: { order: 'asc' },
    });

    if (!learningOutcomes.length) {
      throw new BadRequestException('Modulo tecnico no tiene RA definidos.');
    }

    let importedOutcomes = 0;
    const pendingSpecials: Array<{
      gradeId: string;
      specialScore: number;
    }> = [];

    for (const learningOutcome of learningOutcomes) {
      const baseDto = this.buildTechnicalGradeDto(
        row,
        context,
        student.id,
        subject.id,
        learningOutcome.id,
        learningOutcome.code,
        false,
      );

      const specialScore = this.optionalNumber(
        row,
        `${this.normalizeHeader(learningOutcome.code)}_esp`,
      );

      if (!this.hasTechnicalScores(baseDto) && specialScore === undefined) {
        continue;
      }

      const existing = await this.prisma.technicalGrade.findUnique({
        where: {
          schoolId_schoolYearId_studentId_learningOutcomeId: {
            schoolId: context.schoolId,
            schoolYearId: context.schoolYearId,
            studentId: student.id,
            learningOutcomeId: learningOutcome.id,
          },
        },
        select: { id: true },
      });

      const grade = existing
        ? await this.technicalGradesService.update(
            existing.id,
            this.toTechnicalUpdateDto(baseDto),
            user,
          )
        : await this.technicalGradesService.create(baseDto, user);

      if (specialScore !== undefined) {
        pendingSpecials.push({ gradeId: grade.grade.id, specialScore });
      }

      importedOutcomes += 1;
    }

    if (importedOutcomes === 0) {
      throw new BadRequestException('No technical grade columns were provided.');
    }

    for (const pendingSpecial of pendingSpecials) {
      await this.technicalGradesService.update(
        pendingSpecial.gradeId,
        { specialScore: pendingSpecial.specialScore },
        user,
      );
    }
  }

  private async readRows(file: UploadedExcelFile): Promise<ImportRow[]> {
    this.validateFile(file);

    const workbook = new Workbook();
    const workbookBuffer = file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(workbookBuffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new BadRequestException('The Excel file does not contain worksheets.');
    }

    const headers: string[] = [];
    const rows: ImportRow[] = [];

    worksheet.getRow(1).eachCell((cell, columnNumber) => {
      headers[columnNumber] = this.normalizeHeader(String(this.cellToValue(cell.value) ?? ''));
    });

    worksheet.eachRow((worksheetRow, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const row: ImportRow = { fila: rowNumber };
      let hasValue = false;

      worksheetRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const header = headers[columnNumber];

        if (!header) {
          return;
        }

        const value = this.cellToValue(cell.value);
        row[header] = value;

        if (value !== null && value !== '') {
          hasValue = true;
        }
      });

      if (hasValue) {
        rows.push(row);
      }
    });

    return rows;
  }

  private validateFile(file?: UploadedExcelFile): asserts file is UploadedExcelFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Excel file is required in the file field.');
    }

    if (!file.originalname.match(/\.(xlsx|xlsm|xls)$/i)) {
      throw new BadRequestException('Only Excel files are supported.');
    }
  }

  private async resolveSchoolYearContext(
    schoolYearId: string,
    user: AuthenticatedUser,
  ): Promise<ImportContext> {
    const schoolYear = await this.prisma.schoolYear.findUnique({ where: { id: schoolYearId } });

    if (!schoolYear) {
      throw new NotFoundException('School year not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, schoolYear.schoolId);

    return {
      schoolId: schoolYear.schoolId,
      schoolYearId,
    };
  }

  private async resolveCourseContext(
    schoolYearId: string,
    courseId: string,
    user: AuthenticatedUser,
  ): Promise<Required<ImportContext>> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, schoolYearId },
    });

    if (!course) {
      throw new NotFoundException('Course not found for the selected school year.');
    }

    this.permissionsService.ensureCanAccessSchool(user, course.schoolId);

    return {
      schoolId: course.schoolId,
      schoolYearId,
      courseId,
    };
  }

  private async createJob(params: {
    type: ImportType;
    file: UploadedExcelFile;
    user: AuthenticatedUser;
    context: ImportContext;
    totalRows: number;
  }) {
    return this.prisma.importJob.create({
      data: {
        schoolId: params.context.schoolId,
        schoolYearId: params.context.schoolYearId,
        userId: params.user.id,
        type: params.type,
        fileName: params.file.originalname,
        status: ImportStatus.PROCESSING,
        totalRows: params.totalRows,
      },
    });
  }

  private async finishJob(
    jobId: string,
    schoolId: string,
    userId: string,
    totalRows: number,
    successRows: number,
    errors: string[],
  ): Promise<ImportSummary> {
    const status = errors.length === totalRows ? ImportStatus.FAILED : ImportStatus.COMPLETED;

    const job = await this.prisma.importJob.update({
      where: { id: jobId },
      data: {
        status,
        totalRows,
        successRows,
        errorRows: errors.length,
        errors,
      },
    });
    await this.auditService.logImport({
      schoolId,
      userId,
      entity: 'ImportJob',
      entityId: jobId,
      newValue: job,
    });

    return {
      jobId,
      status,
      totalRows,
      successRows,
      errorRows: errors.length,
      errors,
    };
  }

  private async findStudentByListNumber(row: ImportRow, context: ImportContext) {
    if (!context.courseId) {
      throw new BadRequestException('Course is required to import grades.');
    }

    const listNumber = this.requiredNumber(row, 'numero_lista');
    const student = await this.prisma.student.findFirst({
      where: {
        schoolId: context.schoolId,
        schoolYearId: context.schoolYearId,
        courseId: context.courseId,
        listNumber,
      },
      select: { id: true },
    });

    if (!student) {
      throw new BadRequestException('estudiante no existe.');
    }

    return student;
  }

  private async findSubjectByName(
    row: ImportRow,
    schoolId: string,
    type: SubjectType,
    columnName = 'asignatura',
  ) {
    const name = this.requiredString(row, columnName);
    const subject = await this.prisma.subject.findFirst({
      where: {
        schoolId,
        name,
        type,
        isActive: true,
      },
      select: { id: true },
    });

    if (!subject) {
      throw new BadRequestException(`${columnName} no existe.`);
    }

    return subject;
  }

  private buildAcademicGradeDto(
    row: ImportRow,
    context: ImportContext,
    studentId: string,
    subjectId: string,
    blockNumber: number,
  ): CreateAcademicGradeDto {
    if (!context.courseId) {
      throw new BadRequestException('Course is required to import grades.');
    }

    const prefix = `b${blockNumber}`;

    return {
      schoolId: context.schoolId,
      schoolYearId: context.schoolYearId,
      courseId: context.courseId,
      studentId,
      subjectId,
      blockNumber,
      p1: this.optionalNumber(row, `${prefix}_p1`),
      rp1: this.optionalNumber(row, `${prefix}_rp1`),
      p2: this.optionalNumber(row, `${prefix}_p2`),
      rp2: this.optionalNumber(row, `${prefix}_rp2`),
      p3: this.optionalNumber(row, `${prefix}_p3`),
      rp3: this.optionalNumber(row, `${prefix}_rp3`),
      p4: this.optionalNumber(row, `${prefix}_p4`),
      rp4: this.optionalNumber(row, `${prefix}_rp4`),
    };
  }

  private buildTechnicalGradeDto(
    row: ImportRow,
    context: ImportContext,
    studentId: string,
    subjectId: string,
    learningOutcomeId: string,
    code: string,
    includeSpecial: boolean,
  ): CreateTechnicalGradeDto {
    if (!context.courseId) {
      throw new BadRequestException('Course is required to import grades.');
    }

    const key = this.normalizeHeader(code);

    return {
      schoolId: context.schoolId,
      schoolYearId: context.schoolYearId,
      courseId: context.courseId,
      studentId,
      subjectId,
      learningOutcomeId,
      ordinaryScore: this.optionalNumber(row, key),
      recovery1Score: this.optionalNumber(row, `${key}_r1`),
      recovery2Score: this.optionalNumber(row, `${key}_r2`),
      specialScore: includeSpecial ? this.optionalNumber(row, `${key}_esp`) : undefined,
    };
  }

  private toAcademicUpdateDto(dto: CreateAcademicGradeDto): UpdateAcademicGradeDto {
    return {
      p1: dto.p1,
      rp1: dto.rp1,
      p2: dto.p2,
      rp2: dto.rp2,
      p3: dto.p3,
      rp3: dto.rp3,
      p4: dto.p4,
      rp4: dto.rp4,
    };
  }

  private toTechnicalUpdateDto(dto: CreateTechnicalGradeDto): UpdateTechnicalGradeDto {
    return {
      ordinaryScore: dto.ordinaryScore,
      recovery1Score: dto.recovery1Score,
      recovery2Score: dto.recovery2Score,
      specialScore: dto.specialScore,
    };
  }

  private hasAcademicScores(dto: CreateAcademicGradeDto): boolean {
    return [dto.p1, dto.rp1, dto.p2, dto.rp2, dto.p3, dto.rp3, dto.p4, dto.rp4].some(
      (value) => value !== undefined,
    );
  }

  private hasTechnicalScores(dto: CreateTechnicalGradeDto): boolean {
    return [dto.ordinaryScore, dto.recovery1Score, dto.recovery2Score, dto.specialScore].some(
      (value) => value !== undefined,
    );
  }

  private requiredString(row: ImportRow, key: string): string {
    const value = row[this.normalizeHeader(key)];

    if (value === null || value === undefined || value === '') {
      throw new BadRequestException(`${key} obligatorio.`);
    }

    return String(value).trim();
  }

  private requiredNumber(row: ImportRow, key: string): number {
    const value = this.optionalNumber(row, key);

    if (value === undefined) {
      throw new BadRequestException(`${key} obligatorio.`);
    }

    return value;
  }

  private optionalNumber(row: ImportRow, key: string): number | undefined {
    const value = row[this.normalizeHeader(key)];

    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      throw new BadRequestException(`${key} debe ser numerico.`);
    }

    return numericValue;
  }

  private normalizeHeader(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  private cellToValue(value: unknown): string | number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }

    if (typeof value === 'object' && 'text' in value) {
      return String(value.text);
    }

    if (typeof value === 'object' && 'result' in value) {
      return this.cellToValue(value.result);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return JSON.stringify(value);
  }

  private formatRowError(row: ImportRow, error: unknown): string {
    const rowNumber = row.fila ?? '?';
    return `Fila ${rowNumber}: ${this.errorMessage(error)}`;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof BadRequestException || error instanceof NotFoundException) {
      const response = error.getResponse();

      if (typeof response === 'object' && response !== null && 'message' in response) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message.join(', ') : message;
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Error desconocido.';
  }

  private rethrowImportPrismaError(error: unknown, conflictMessage: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException(conflictMessage);
    }

    throw error;
  }
}
