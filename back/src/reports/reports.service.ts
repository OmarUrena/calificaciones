import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  Prisma,
  SubjectStatus,
  SubjectType,
  UserRole,
  type Subject,
} from '@prisma/client';
import { chromium } from 'playwright';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

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

    const html = this.buildDocumentHtml([this.buildStudentReportHtml(data, period)]);
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
      studentReports.map((studentReport) => this.buildStudentReportHtml(studentReport, period)),
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

  private buildStudentReportHtml(data: StudentReportData, period: number): string {
    const { student } = data;
    const studentName = `${student.firstName} ${student.lastName}`;

    return `
      <section class="report-page">
        <header class="report-header">
          <div class="school-logo">${student.school.logoUrl ? `<img src="${this.escapeAttribute(student.school.logoUrl)}" alt="Logo" />` : ''}</div>
          <div>
            <h1>${this.escapeHtml(student.school.name)}</h1>
            <p>${this.escapeHtml(student.school.address ?? '')}</p>
            <p>Año escolar: ${this.escapeHtml(student.schoolYear.name)}</p>
          </div>
        </header>

        <section class="student-info">
          <div><strong>Estudiante:</strong> ${this.escapeHtml(studentName)}</div>
          <div><strong>Número de lista:</strong> ${student.listNumber}</div>
          <div><strong>Curso:</strong> ${this.escapeHtml(student.course.name)}</div>
          <div><strong>Grado:</strong> ${this.escapeHtml(student.course.grade)}</div>
          <div><strong>Sección:</strong> ${this.escapeHtml(student.course.section ?? '-')}</div>
          <div><strong>Área:</strong> ${this.escapeHtml(student.course.area ?? '-')}</div>
          <div><strong>Modalidad:</strong> ${this.escapeHtml(student.course.modality ?? '-')}</div>
          <div><strong>Maestro titular:</strong> ${this.escapeHtml(student.course.titular?.name ?? '-')}</div>
          <div><strong>Periodo mostrado:</strong> ${period}</div>
        </section>

        ${this.buildAcademicSection(data, period)}
        ${this.buildTechnicalSection(data, period)}
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
            body { color: #111827; font-family: Arial, sans-serif; font-size: 9px; margin: 0; }
            h1 { font-size: 16px; margin: 0 0 4px; }
            h2 { border-bottom: 1px solid #d1d5db; font-size: 12px; margin: 14px 0 6px; padding-bottom: 4px; }
            h3 { font-size: 10px; margin: 10px 0 4px; }
            p { margin: 2px 0; }
            table { border-collapse: collapse; margin-top: 8px; width: 100%; }
            th, td { border: 1px solid #d1d5db; padding: 4px 5px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; font-weight: 700; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; }
            .numeric { text-align: center; }
            .recovery { background: #f8fafc; }
            .average { background: #eaf2f8; font-weight: 700; text-align: center; }
            .subject-name { font-weight: 700; vertical-align: middle; }
            .academic-detail { font-size: 7px; table-layout: fixed; }
            .academic-detail th, .academic-detail td { line-height: 1.15; overflow-wrap: anywhere; padding: 3px 1px; }
            .academic-detail .subject-column { width: 110px; }
            .academic-detail .competency-heading { font-size: 7.5px; text-align: center; }
            .academic-summary { font-size: 8px; }
            .academic-summary th, .academic-summary td { padding: 4px; }
            .technical-grid { font-size: 8px; table-layout: fixed; }
            .technical-grid th, .technical-grid td { padding: 4px 2px; vertical-align: middle; }
            .technical-grid .module-column { width: 190px; }
            .technical-grid .result-column { width: 48px; }
            .technical-grid .status-column { width: 68px; }
            .report-page { break-after: page; min-height: 185mm; }
            .report-page:last-child { break-after: auto; }
            .report-header { align-items: center; border-bottom: 2px solid #111827; display: grid; gap: 14px; grid-template-columns: 80px 1fr; padding-bottom: 12px; }
            .school-logo { align-items: center; border: 1px solid #d1d5db; display: flex; height: 70px; justify-content: center; width: 70px; }
            .school-logo img { max-height: 64px; max-width: 64px; object-fit: contain; }
            .student-info { display: grid; gap: 6px 14px; grid-template-columns: 1fr 1fr; margin-top: 14px; }
            .empty { border: 1px solid #d1d5db; color: #6b7280; padding: 10px; }
          </style>
        </head>
        <body>${pages.join('')}</body>
      </html>
    `;
  }

  private async renderPdf(html: string): Promise<Buffer> {
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const pdf = await page.pdf({
        format: 'Letter',
        landscape: true,
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
