import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  Prisma,
  SubjectStatus,
  SubjectType,
  UserRole,
  type Subject,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { launchReportBrowser } from './report-browser';
import { SubjectGradeReportQueryDto } from './dto/subject-grade-report-query.dto';
import { buildSubjectGradeReportHtml, subjectGradeReportFilename } from './subject-grade-report';

type ReportStudent = Prisma.StudentGetPayload<{
  include: {
    school: true;
    schoolYear: true;
    course: { include: { titular: true } };
  };
}>;

type AcademicResult = Prisma.AcademicSubjectResultGetPayload<{
  include: { subject: true };
}>;

type AcademicGrade = Prisma.AcademicGradeGetPayload<{
  include: { subject: true };
}>;

type TechnicalResult = Prisma.TechnicalSubjectResultGetPayload<{
  include: { subject: true };
}>;

type TechnicalGrade = Prisma.TechnicalGradeGetPayload<{
  include: { subject: true; learningOutcome: true };
}>;

type TechnicalLearningOutcome = Prisma.TechnicalLearningOutcomeGetPayload<object>;

type StudentReportData = {
  student: ReportStudent;
  assignedSubjects: Subject[];
  academicResults: AcademicResult[];
  academicGrades: AcademicGrade[];
  technicalResults: TechnicalResult[];
  technicalGrades: TechnicalGrade[];
  technicalLearningOutcomes: TechnicalLearningOutcome[];
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) {}

  async generateStudentReportCard(
    studentId: string,
    period: number,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const data = await this.getStudentReportData(studentId);

    await this.ensureCanGenerateCourseReports(data.student.courseId, data.student.schoolId, user);

    const html = this.buildDocumentHtml(this.buildStudentReportPages(data, period));
    const pdf = await this.renderPdf(html);

    await this.auditService.log({
      schoolId: data.student.schoolId,
      userId: user.id,
      entity: 'Student',
      entityId: data.student.id,
      action: AuditAction.GENERATE_REPORT,
      newValue: {
        report: 'student-report-card',
        period,
        courseId: data.student.courseId,
      },
    });

    return pdf;
  }

  async generateCourseReportCards(
    courseId: string,
    period: number,
    user: AuthenticatedUser,
  ): Promise<Buffer> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { students: { orderBy: { listNumber: 'asc' } } },
    });

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    await this.ensureCanGenerateCourseReports(course.id, course.schoolId, user);

    const studentReports = await Promise.all(
      course.students.map((student) => this.getStudentReportData(student.id)),
    );
    const html = this.buildDocumentHtml(
      studentReports.flatMap((studentReport) =>
        this.buildStudentReportPages(studentReport, period),
      ),
    );
    const pdf = await this.renderPdf(html);

    await this.auditService.log({
      schoolId: course.schoolId,
      userId: user.id,
      entity: 'Course',
      entityId: course.id,
      action: AuditAction.GENERATE_REPORT,
      newValue: {
        report: 'course-report-cards',
        period,
        studentCount: course.students.length,
      },
    });

    return pdf;
  }

  private async findSubjectReportAssignment(assignmentId: string, user: AuthenticatedUser) {
    if (user.role === UserRole.TEACHER && !user.teacherId) {
      throw new ForbiddenException('Tu usuario no está vinculado a un maestro.');
    }
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: {
        id: assignmentId,
        isActive: true,
        ...(user.role === UserRole.SUPER_ADMIN ? {} : { schoolId: user.schoolId ?? '' }),
        ...(user.role === UserRole.TEACHER ? { teacherId: user.teacherId! } : {}),
      },
      include: { school: true, schoolYear: true, course: true, subject: true, teacher: true },
    });
    if (!assignment)
      throw new NotFoundException('La asignatura no está disponible para tu usuario.');
    this.permissionsService.ensureCanAccessSchool(user, assignment.schoolId);
    return assignment;
  }

  private subjectReportScope(assignment: {
    schoolId: string;
    schoolYearId: string;
    courseId: string;
    subjectId: string;
  }) {
    return {
      schoolId: assignment.schoolId,
      schoolYearId: assignment.schoolYearId,
      courseId: assignment.courseId,
      subjectId: assignment.subjectId,
    };
  }

  private reportOutcomes(where: {
    schoolId: string;
    schoolYearId: string;
    courseId: string;
    subjectId: string;
  }) {
    return this.prisma.technicalLearningOutcome.findMany({
      where: {
        schoolId: where.schoolId,
        subjectId: where.subjectId,
        OR: [{ isActive: true }, { technicalGrades: { some: where } }],
      },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
    });
  }

  async subjectGradeReportOptions(assignmentId: string, user: AuthenticatedUser) {
    const assignment = await this.findSubjectReportAssignment(assignmentId, user);
    return {
      type: assignment.subject.type,
      periods: assignment.subject.type === SubjectType.ACADEMIC ? [1, 2, 3, 4] : [],
      outcomes:
        assignment.subject.type === SubjectType.TECHNICAL
          ? await this.reportOutcomes(this.subjectReportScope(assignment))
          : [],
    };
  }

  async generateSubjectGradeReport(
    assignmentId: string,
    period: number | undefined,
    user: AuthenticatedUser,
    selection: SubjectGradeReportQueryDto = {},
  ) {
    const assignment = await this.findSubjectReportAssignment(assignmentId, user);
    const academic = assignment.subject.type === SubjectType.ACADEMIC;
    const periods = selection.periods ?? (period === undefined ? [] : [period]);
    if (selection.periods !== undefined && period !== undefined) {
      throw new BadRequestException('Usa una sola selección de períodos.');
    }
    if (
      academic &&
      (!periods.length ||
        periods.length > 4 ||
        new Set(periods).size !== periods.length ||
        periods.some((value) => !Number.isInteger(value) || value < 1 || value > 4))
    ) {
      throw new BadRequestException('Marca uno o varios períodos entre P1 y P4.');
    }
    if (!academic && periods.length) {
      throw new BadRequestException('Las asignaturas técnicas se generan por RA, sin período.');
    }
    if (academic && selection.outcomeIds !== undefined)
      throw new BadRequestException('Las asignaturas académicas se generan por períodos.');
    periods.sort((left, right) => left - right);
    const where = this.subjectReportScope(assignment);
    const availableOutcomes = academic ? [] : await this.reportOutcomes(where);
    if (
      !academic &&
      selection.outcomeIds !== undefined &&
      (!selection.outcomeIds.length ||
        new Set(selection.outcomeIds).size !== selection.outcomeIds.length ||
        selection.outcomeIds.some((id) => !availableOutcomes.some((outcome) => outcome.id === id)))
    ) {
      throw new BadRequestException('Marca RA disponibles para esta asignatura.');
    }
    const outcomes =
      selection.outcomeIds === undefined
        ? availableOutcomes
        : availableOutcomes.filter((outcome) => selection.outcomeIds!.includes(outcome.id));
    const students = await this.prisma.student.findMany({
      where: {
        schoolId: where.schoolId,
        schoolYearId: where.schoolYearId,
        courseId: where.courseId,
      },
      orderBy: { listNumber: 'asc' },
    });
    const identity = {
      school: assignment.school.name,
      schoolYear: assignment.schoolYear.name,
      course: assignment.course.name,
      subject: assignment.subject.name,
      teacher: assignment.teacher.name,
      students,
    };
    let html: string;
    if (academic) {
      const grades = await this.prisma.academicGrade.findMany({
        where,
        orderBy: [{ student: { listNumber: 'asc' } }, { blockNumber: 'asc' }],
      });
      html = buildSubjectGradeReportHtml({
        ...identity,
        type: 'ACADEMIC',
        periods,
        grades,
        blockTitles: [1, 2, 3, 4].map((block) => this.academicBlockTitle(block)),
      });
    } else {
      const grades = await this.prisma.technicalGrade.findMany({
        where: {
          ...where,
          ...(selection.outcomeIds === undefined
            ? {}
            : { learningOutcomeId: { in: outcomes.map((outcome) => outcome.id) } }),
        },
      });
      html = buildSubjectGradeReportHtml({ ...identity, type: 'TECHNICAL', grades, outcomes });
    }
    const buffer = await this.renderPdf(html, false);
    await this.auditService.log({
      schoolId: assignment.schoolId,
      userId: user.id,
      entity: 'TeacherAssignment',
      entityId: assignment.id,
      action: AuditAction.GENERATE_REPORT,
      newValue: {
        report: 'subject-grade-register',
        courseId: assignment.courseId,
        subjectId: assignment.subjectId,
        period: academic && periods.length === 1 ? periods[0] : null,
        periods: academic ? periods : [],
        outcomeIds: academic ? [] : outcomes.map((outcome) => outcome.id),
        studentCount: students.length,
      },
    });
    return {
      buffer,
      filename: subjectGradeReportFilename(
        identity.course,
        identity.subject,
        academic ? periods : undefined,
        !academic && selection.outcomeIds !== undefined
          ? outcomes.map((outcome) => outcome.code)
          : undefined,
      ),
    };
  }

  private async ensureCanGenerateCourseReports(
    courseId: string,
    schoolId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    this.permissionsService.ensureCanAccessSchool(user, schoolId);

    if (user.role === UserRole.TEACHER) {
      await this.permissionsService.ensureTeacherCanGenerateCourseReport({ user, courseId });
    }
  }

  private async getStudentReportData(studentId: string): Promise<StudentReportData> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        school: true,
        schoolYear: true,
        course: { include: { titular: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    const [
      assignedSubjectLinks,
      academicResults,
      academicGrades,
      technicalResults,
      technicalGrades,
      technicalLearningOutcomes,
    ] = await Promise.all([
      this.prisma.teacherAssignment.findMany({
        where: {
          schoolId: student.schoolId,
          schoolYearId: student.schoolYearId,
          courseId: student.courseId,
          isActive: true,
        },
        select: { subject: true },
        orderBy: { subject: { name: 'asc' } },
      }),
      this.prisma.academicSubjectResult.findMany({
        where: {
          schoolId: student.schoolId,
          schoolYearId: student.schoolYearId,
          courseId: student.courseId,
          studentId: student.id,
        },
        include: { subject: true },
        orderBy: { subject: { name: 'asc' } },
      }),
      this.prisma.academicGrade.findMany({
        where: {
          schoolId: student.schoolId,
          schoolYearId: student.schoolYearId,
          courseId: student.courseId,
          studentId: student.id,
        },
        include: { subject: true },
        orderBy: [{ subject: { name: 'asc' } }, { blockNumber: 'asc' }],
      }),
      this.prisma.technicalSubjectResult.findMany({
        where: {
          schoolId: student.schoolId,
          schoolYearId: student.schoolYearId,
          courseId: student.courseId,
          studentId: student.id,
        },
        include: { subject: true },
        orderBy: { subject: { name: 'asc' } },
      }),
      this.prisma.technicalGrade.findMany({
        where: {
          schoolId: student.schoolId,
          schoolYearId: student.schoolYearId,
          courseId: student.courseId,
          studentId: student.id,
        },
        include: { subject: true, learningOutcome: true },
        orderBy: [{ subject: { name: 'asc' } }, { learningOutcome: { order: 'asc' } }],
      }),
      this.prisma.technicalLearningOutcome.findMany({
        where: {
          schoolId: student.schoolId,
          isActive: true,
          subject: {
            teacherAssignments: {
              some: {
                schoolId: student.schoolId,
                schoolYearId: student.schoolYearId,
                courseId: student.courseId,
                isActive: true,
              },
            },
          },
        },
        orderBy: [{ subject: { displayOrder: 'asc' } }, { order: 'asc' }],
      }),
    ]);

    return {
      student,
      assignedSubjects: assignedSubjectLinks.map((assignment) => assignment.subject),
      academicResults,
      academicGrades,
      technicalResults,
      technicalGrades,
      technicalLearningOutcomes,
    };
  }

  private buildStudentReportPages(data: StudentReportData, period: number): string[] {
    return [this.buildStudentReportHtml(data, period), this.buildStudentCoverHtml(data)];
  }

  private buildStudentReportHtml(data: StudentReportData, period: number): string {
    const { student } = data;
    const studentName = `${student.firstName} ${student.lastName}`;

    return `
      <section class="report-page grades-page period-${period}">
        <div class="grades-content">
          <section class="student-info">
            <div><strong>Estudiante:</strong> ${this.escapeHtml(studentName)}</div>
            <div><strong>Número de lista:</strong> ${student.listNumber}</div>
            <div><strong>Curso:</strong> ${this.escapeHtml(student.course.name)}</div>
          </section>
          ${this.buildAcademicSection(data, period)}
          ${this.buildTechnicalSection(data, period)}
        </div>
        <footer class="grades-signatures">
          <div class="grades-signature">
            <div class="grades-signature-name">INOCENCIA FABIAN</div>
            <div>DIRECTORA</div>
          </div>
          <div class="grades-signature">
            <div class="grades-signature-name">${this.escapeHtml(student.course.titular?.name?.trim().toUpperCase() || 'NOMBRE DEL MAESTRO')}</div>
            <div>MAESTRO TITULAR</div>
          </div>
        </footer>
      </section>
    `;
  }

  private buildStudentCoverHtml({ student }: StudentReportData): string {
    const { school, course } = student;
    const field = (label: string, value: string | number | null | undefined) =>
      `<p><strong>${label}:</strong> <span class="cover-value">${this.escapeHtml(String(value ?? '').trim())}</span></p>`;

    return `
      <section class="report-page report-cover">
        <div class="cover-notes">
          <table class="signature-table">
            <thead><tr><th>FIRMA DEL PADRE, MADRE O TUTOR</th></tr></thead>
            <tbody>
              <tr><td class="signature-subtitle">Períodos de reportes de calificaciones</td></tr>
              ${['Ago–Sept–Oct', 'Nov–Dic–Ene', 'Feb–Mar', 'Abr–May–Jun'].map((label) => `<tr><td><div class="signature-line"><span>${label}</span><span></span></div></td></tr>`).join('')}
            </tbody>
          </table>
          <table class="observations-table">
            <thead><tr><th>OBSERVACIONES</th></tr></thead>
            <tbody>
              ${Array.from({ length: 16 }, () => '<tr><td></td></tr>').join('')}
            </tbody>
          </table>
        </div>
        <div class="cover-identity">
          <header class="cover-heading">
            ${school.logoUrl ? `<img class="cover-logo" src="${this.escapeAttribute(school.logoUrl)}" alt="Logo del centro educativo" />` : ''}
            <h1>${this.escapeHtml(school.name)}</h1>
            <p class="cover-title">BOLETÍN DE CALIFICACIONES</p>
            <h2>${this.escapeHtml(course.name)}</h2>
            <p class="cover-year"><strong>Año escolar: ${this.escapeHtml(student.schoolYear.name)}</strong></p>
          </header>
          <div class="cover-student">
            <div class="cover-student-row">${field('Sección', course.section)}${field('Número de orden', student.listNumber)}</div>
            ${field('Nombre(s)', student.firstName)}
            ${field('Apellido(s)', student.lastName)}
          </div>
          <div class="cover-teacher">
            ${field('Docente', course.titular?.name)}
          </div>
          <div class="cover-school">
            <div class="cover-school-row">${field('Código del centro', school.code)}${field('Teléfono', school.phone)}</div>
            ${field('Dirección', school.address)}
            ${field('Regional educativa', school.educationalRegion)}
            ${field('Distrito educativo', school.educationalDistrict)}
          </div>
          <div class="cover-location">
            ${field('Provincia', school.province)}
            ${field('Municipio', school.municipality)}
          </div>
        </div>
      </section>
    `;
  }

  private buildAcademicSection(data: StudentReportData, period: number): string {
    const gradesBySubject = this.groupBy(data.academicGrades, (grade) => grade.subjectId);
    const subjects = this.uniqueAcademicSubjects(data);

    if (!subjects.length) {
      return this.emptySection(
        'Asignaturas académicas',
        'No hay calificaciones académicas registradas.',
      );
    }

    const detailRows = subjects.map((subject) => {
      const grades = gradesBySubject.get(subject.id) ?? [];
      const gradesByBlock = new Map(grades.map((grade) => [grade.blockNumber, grade]));
      const scoreCells = Array.from({ length: 4 }, (_, blockIndex) => {
        const grade = gradesByBlock.get(blockIndex + 1);
        return Array.from({ length: period }, (_, periodIndex) => {
          const scoreNumber = periodIndex + 1;
          return `
            <td class="numeric">${this.formatScore(grade?.[`p${scoreNumber}` as keyof AcademicGrade] as Prisma.Decimal | null | undefined)}</td>
            <td class="numeric recovery">${this.formatScore(grade?.[`rp${scoreNumber}` as keyof AcademicGrade] as Prisma.Decimal | null | undefined)}</td>
          `;
        }).join('');
      }).join('');

      return `
        <tr>
          <td class="subject-name">${this.escapeHtml(subject.name)}</td>
          ${scoreCells}
        </tr>
      `;
    });

    const summaryRows = subjects.map((subject) => {
      const grades = gradesBySubject.get(subject.id) ?? [];
      const result = data.academicResults.find((item) => item.subjectId === subject.id);
      const gradesByBlock = new Map(grades.map((grade) => [grade.blockNumber, grade]));
      const averages = Array.from({ length: 4 }, (_, blockIndex) => {
        const blockNumber = blockIndex + 1;
        const grade = gradesByBlock.get(blockNumber);
        const storedAverage = result?.[`pc${blockNumber}` as keyof AcademicResult] as
          | Prisma.Decimal
          | null
          | undefined;
        return this.formatScore(period === 4 ? (grade?.pc ?? storedAverage) : null);
      });
      const finalCells =
        period === 4
          ? `
            <td class="numeric">${this.formatScore(result?.cf)}</td>
            <td class="numeric">${this.formatScore(result?.cec)}</td>
            <td class="numeric">${this.formatScore(result?.ccf)}</td>
            <td class="numeric">${this.formatScore(result?.ceex)}</td>
            <td class="numeric">${this.formatScore(result?.cexf)}</td>
            <td class="numeric">${this.formatScore(result?.ce)}</td>
            <td class="numeric">${this.formatScore(result?.cef)}</td>
            <td>${this.formatStatus(result?.status)}</td>
          `
          : '';

      return `
        <tr>
          <td class="subject-name">${this.escapeHtml(subject.name)}</td>
          ${averages.map((average) => `<td class="numeric average">${average}</td>`).join('')}
          ${finalCells}
        </tr>
      `;
    });

    return `
      <h2>Asignaturas académicas</h2>
      <table class="academic-detail period-${period}">
        <colgroup><col class="subject-column" /></colgroup>
        <thead>
          <tr>
            <th rowspan="2">Asignatura académica</th>
            ${Array.from({ length: 4 }, (_, index) => `<th colspan="${period * 2}" class="competency-heading">${this.escapeHtml(this.academicBlockTitle(index + 1))}</th>`).join('')}
          </tr>
          <tr>
            ${Array.from({ length: 4 }, () => Array.from({ length: period }, (_, index) => `<th class="numeric">P${index + 1}</th><th class="numeric recovery">RP${index + 1}</th>`).join('')).join('')}
          </tr>
        </thead>
        <tbody>${detailRows.join('')}</tbody>
      </table>

      ${
        period === 4
          ? `
      <h3>Promedios por bloque y resultado final</h3>
      <table class="academic-summary">
        <thead>
          <tr>
            <th>Asignatura académica</th>
            <th class="numeric average">PC1</th><th class="numeric average">PC2</th><th class="numeric average">PC3</th><th class="numeric average">PC4</th>
            ${period === 4 ? '<th class="numeric">CF</th><th class="numeric">CEC</th><th class="numeric">CCF</th><th class="numeric">CEEX</th><th class="numeric">CEXF</th><th class="numeric">CE</th><th class="numeric">CEF</th><th>Estado</th>' : ''}
          </tr>
        </thead>
        <tbody>${summaryRows.join('')}</tbody>
      </table>
      `
          : ''
      }
    `;
  }

  private buildTechnicalSection(data: StudentReportData, period: number): string {
    const gradesBySubject = this.groupBy(data.technicalGrades, (grade) => grade.subjectId);
    const subjects = this.uniqueTechnicalSubjects(data);

    if (!subjects.length) {
      return this.emptySection('Módulos técnicos', 'No hay calificaciones técnicas registradas.');
    }

    const outcomesBySubject = new Map(
      subjects.map((subject) => [
        subject.id,
        this.uniqueTechnicalLearningOutcomes(data, subject.id),
      ]),
    );
    const maximumOutcomeOrder = Math.max(
      0,
      ...Array.from(outcomesBySubject.values()).flatMap((outcomes) =>
        outcomes.map((outcome) => outcome.order),
      ),
    );

    const rows = subjects.map((subject) => {
      const grades = gradesBySubject.get(subject.id) ?? [];
      const result = data.technicalResults.find((item) => item.subjectId === subject.id);
      const gradesByOutcome = new Map(grades.map((grade) => [grade.learningOutcomeId, grade]));
      const outcomesByOrder = new Map(
        (outcomesBySubject.get(subject.id) ?? []).map((outcome) => [outcome.order, outcome]),
      );
      const raCells = Array.from({ length: maximumOutcomeOrder }, (_, index) => {
        const outcome = outcomesByOrder.get(index + 1);

        if (!outcome) {
          return '<td class="numeric">-</td>';
        }

        const grade = gradesByOutcome.get(outcome.id);
        return `<td class="numeric">${this.formatScore(grade?.validScore)}/${this.formatScore(outcome.weight)}</td>`;
      }).join('');
      const finalCells =
        period === 4
          ? `
            <td class="numeric">${this.formatScore(result?.totalScore)}</td>
            <td class="numeric">${this.formatScore(result?.finalScore)}</td>
            <td>${this.formatStatus(result?.status)}</td>
          `
          : '';

      return `
        <tr>
          <td class="subject-name">${this.escapeHtml(subject.name)}</td>
          ${raCells}
          ${finalCells}
        </tr>
      `;
    });

    return `
      <h2>Módulos técnicos</h2>
      <table class="technical-grid">
        <colgroup>
          <col class="module-column" />
          ${Array.from({ length: maximumOutcomeOrder }, () => '<col class="ra-column" />').join('')}
          ${period === 4 ? '<col class="result-column" /><col class="result-column" /><col class="status-column" />' : ''}
        </colgroup>
        <thead>
          <tr>
            <th>Módulos formativos</th>
            ${Array.from({ length: maximumOutcomeOrder }, (_, index) => `<th class="numeric">RA${index + 1}</th>`).join('')}
            ${period === 4 ? '<th class="numeric">Total</th><th class="numeric">Final</th><th>Estado</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    `;
  }

  private buildDocumentHtml(pages: string[]): string {
    return `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: letter landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { color: #111827; font-family: Arial, sans-serif; font-size: 12px; margin: 0; }
            h1 { font-size: 16px; margin: 0 0 4px; }
            h2 { border-bottom: 1px solid #d1d5db; font-size: 14px; margin: 10px 0 5px; padding-bottom: 3px; }
            h3 { font-size: 12px; margin: 8px 0 4px; }
            p { margin: 2px 0; }
            table { border-collapse: collapse; margin-top: 5px; width: 100%; }
            th, td { border: 1px solid #d1d5db; padding: 5px 3px; text-align: left; vertical-align: middle; }
            th { background: #f3f4f6; font-weight: 700; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; }
            .numeric { text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
            .recovery { background: #f8fafc; }
            .average { background: #eaf2f8; font-weight: 700; text-align: center; }
            .subject-name { font-weight: 700; vertical-align: middle; }
            .grades-content { font-size: 12px; }
            .period-1 .grades-content { font-size: 15px; }
            .period-2 .grades-content { font-size: 14px; }
            .period-3 .grades-content { font-size: 12px; }
            .academic-detail { font-size: inherit; table-layout: fixed; }
            .academic-detail th, .academic-detail td { line-height: 1.2; padding: 5px 1px; }
            .academic-detail .subject-column { width: 19%; }
            .academic-detail .subject-name { font-size: 12px; overflow-wrap: anywhere; }
            .academic-detail .competency-heading { font-size: 11px; text-align: center; overflow-wrap: anywhere; }
            .academic-detail.period-4 { font-size: 10px; }
            .academic-detail.period-4 .competency-heading { font-size: 10px; }
            .academic-summary { font-size: 11px; table-layout: auto; }
            .academic-summary .numeric { width: 1%; padding: 5px 6px; }
            .technical-grid { font-size: inherit; table-layout: auto; }
            .technical-grid .numeric { width: 1%; padding: 5px 6px; }
            .technical-grid .subject-name { font-size: 12px; overflow-wrap: anywhere; }
            .report-page { break-after: page; width: 259.4mm; max-width: 100%; }
            .report-page:last-child { break-after: auto; }
            .grades-page { height: 195mm; position: relative; }
            .grades-signatures { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; gap: 32px; padding-top: 32px; font-size: 12px; line-height: 16px; break-inside: avoid; }
            .grades-signature { width: 32%; text-align: center; }
            .grades-signature-name { border-top: 1px solid #111827; padding-top: 4px; font-weight: 700; overflow-wrap: anywhere; }
            .student-info { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr) auto minmax(0, 2fr); align-items: baseline; border-bottom: 1px solid #111827; padding-bottom: 8px; }
            .student-info > div { min-width: 0; overflow-wrap: anywhere; }
            .report-cover { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14mm; padding: 3mm 0; color: #172b40; font-size: 14px; line-height: 1.4; }
            .cover-notes { padding-top: 2mm; }
            .report-cover table { margin: 0; }
            .report-cover th { background: #eaf2f8; color: #1f4e79; text-align: center; font-size: 14px; padding: 9px 6px; letter-spacing: 0.3px; }
            .report-cover td, .report-cover th { border: 1px solid #8fa6bb; }
            .signature-table td { border-top: 0; border-bottom: 0; padding: 8px 10px; }
            .signature-table tr:last-child td { border-bottom: 1px solid #8fa6bb; padding-bottom: 12px; }
            .signature-subtitle { text-align: center; color: #52677b; }
            .signature-line { display: flex; align-items: baseline; gap: 10px; }
            .signature-line > span:last-child { flex: 1; border-bottom: 1px solid #8fa6bb; }
            .report-cover .observations-table { margin-top: 8mm; }
            .observations-table td { height: 6.5mm; padding: 0 8px; }
            .cover-identity { min-width: 0; overflow-wrap: anywhere; border-top: 4px solid #1f4e79; padding-top: 4mm; }
            .cover-heading { text-align: center; margin-bottom: 4mm; }
            .cover-logo { display: block; width: 30mm; height: 18mm; object-fit: contain; margin: 0 auto 3mm; }
            .cover-heading h1 { font-size: 22px; line-height: 1.2; margin: 0 0 3mm; color: #1f4e79; }
            .cover-title { color: #1f4e79; font-size: 17px; font-weight: 700; letter-spacing: 0.6px; }
            .cover-heading h2 { color: #364f68; font-size: 18px; line-height: 1.25; border: 0; padding: 0; margin: 3mm 0; }
            .cover-heading .cover-year { display: inline-block; background: #eaf2f8; padding: 5px 14px; border-radius: 4px; margin: 2mm 0 0; font-size: 15px; }
            .cover-identity p { margin: 0 0 2mm; }
            .cover-identity strong { color: #1f4e79; }
            .cover-student { background: #f3f7fb; border-left: 3px solid #1f4e79; padding: 10px 12px 4px; font-size: 15px; }
            .cover-student-row, .cover-school-row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 12px; }
            .cover-value { color: #172b40; }
            .cover-value:empty { display: inline-block; min-width: 30mm; border-bottom: 1px solid; }
            .cover-teacher { margin-top: 3mm; }
            .cover-school { margin-top: 3mm; border-top: 1px solid #cad6e1; padding-top: 3mm; }
            .cover-location { margin-top: 3mm; border-top: 1px solid #cad6e1; padding-top: 3mm; }
            .empty { border: 1px solid #d1d5db; color: #6b7280; padding: 10px; }
          </style>
        </head>
        <body>${pages.join('')}</body>
      </html>
    `;
  }

  private async renderPdf(html: string, landscape = true): Promise<Buffer> {
    const browser = await launchReportBrowser();

    try {
      const page = await browser.newPage();
      await page.emulateMedia({ media: 'print' });
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        // Fit each student's grades independently, including unusually long subject lists.
        // Leave a small allowance for Chromium's print rounding at page boundaries.
        for (const sheet of document.querySelectorAll<HTMLElement>('.grades-page')) {
          const content = sheet.querySelector<HTMLElement>('.grades-content');
          if (!content) continue;
          const signatures = sheet.querySelector<HTMLElement>('.grades-signatures');
          const availableHeight = sheet.clientHeight - (signatures?.offsetHeight ?? 0) - 16;
          let zoom = 1;
          for (let attempt = 0; attempt < 8; attempt++) {
            const bounds = content.getBoundingClientRect();
            const scale = Math.min(
              1,
              (availableHeight - 2) / bounds.height,
              sheet.clientWidth / Math.max(bounds.width, content.scrollWidth * zoom),
            );
            if (scale >= 1) break;
            zoom *= scale * 0.995;
            content.style.zoom = String(zoom);
          }
        }
      });
      const pdf = await page.pdf({
        format: 'Letter',
        landscape,
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private uniqueAcademicSubjects(data: StudentReportData) {
    const subjects = (data.assignedSubjects ?? []).filter(
      (subject) => subject.type === SubjectType.ACADEMIC,
    );

    for (const result of data.academicResults) {
      if (!subjects.some((subject) => subject.id === result.subject.id)) {
        subjects.push(result.subject);
      }
    }

    for (const grade of data.academicGrades) {
      if (!subjects.some((subject) => subject.id === grade.subject.id)) {
        subjects.push(grade.subject);
      }
    }

    return subjects.sort((a, b) => this.compareSubjects(a, b));
  }

  private academicBlockTitle(blockNumber: number): string {
    const titles = this.config.get<string[]>('reports.academicBlockTitles') ?? [];
    return titles[blockNumber - 1]?.trim() || `Competencia académica ${blockNumber}`;
  }

  private uniqueTechnicalSubjects(data: StudentReportData) {
    const subjects = (data.assignedSubjects ?? []).filter(
      (subject) => subject.type === SubjectType.TECHNICAL,
    );

    for (const result of data.technicalResults) {
      if (!subjects.some((subject) => subject.id === result.subject.id)) {
        subjects.push(result.subject);
      }
    }

    for (const grade of data.technicalGrades) {
      if (!subjects.some((subject) => subject.id === grade.subject.id)) {
        subjects.push(grade.subject);
      }
    }

    return subjects.sort((a, b) => this.compareSubjects(a, b));
  }

  private uniqueTechnicalLearningOutcomes(
    data: StudentReportData,
    subjectId: string,
  ): TechnicalLearningOutcome[] {
    const outcomes = (data.technicalLearningOutcomes ?? []).filter(
      (outcome) => outcome.subjectId === subjectId,
    );

    for (const grade of data.technicalGrades) {
      if (
        grade.subjectId === subjectId &&
        !outcomes.some((outcome) => outcome.id === grade.learningOutcome.id)
      ) {
        outcomes.push(grade.learningOutcome);
      }
    }

    return outcomes.sort(
      (left, right) => left.order - right.order || left.code.localeCompare(right.code, 'es'),
    );
  }

  private compareSubjects(left: Subject, right: Subject): number {
    const orderDifference = left.displayOrder - right.displayOrder;
    return orderDifference || left.name.localeCompare(right.name, 'es');
  }

  private groupBy<T>(items: T[], keySelector: (item: T) => string): Map<string, T[]> {
    const grouped = new Map<string, T[]>();

    for (const item of items) {
      const key = keySelector(item);
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }

    return grouped;
  }

  private emptySection(title: string, message: string): string {
    return `<h2>${this.escapeHtml(title)}</h2><div class="empty">${this.escapeHtml(message)}</div>`;
  }

  private formatScore(value: Prisma.Decimal | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 1);
  }

  private formatStatus(status: SubjectStatus | null | undefined): string {
    return status ? this.escapeHtml(status) : '-';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value);
  }
}
