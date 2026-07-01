import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, SubjectStatus, UserRole } from '@prisma/client';
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

type StudentReportData = {
  student: ReportStudent;
  academicResults: AcademicResult[];
  academicGrades: AcademicGrade[];
  technicalResults: TechnicalResult[];
  technicalGrades: TechnicalGrade[];
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
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

    const [academicResults, academicGrades, technicalResults, technicalGrades] = await Promise.all([
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
    ]);

    return {
      student,
      academicResults,
      academicGrades,
      technicalResults,
      technicalGrades,
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

    if (!data.academicResults.length && !data.academicGrades.length) {
      return this.emptySection(
        'Asignaturas académicas',
        'No hay calificaciones académicas registradas.',
      );
    }

    const rows = this.uniqueAcademicSubjects(data).map((subject) => {
      const grades = gradesBySubject.get(subject.id) ?? [];
      const result = data.academicResults.find((item) => item.subjectId === subject.id);
      const periodScores = Array.from({ length: period }, (_, index) =>
        this.formatScore(this.calculateAcademicPeriodAverage(grades, index + 1)),
      );
      const finalCells =
        period === 4
          ? `
            <td>${this.formatScore(result?.cf)}</td>
            <td>${this.formatScore(result?.ccf)}</td>
            <td>${this.formatScore(result?.cexf)}</td>
            <td>${this.formatScore(result?.cef)}</td>
            <td>${this.formatStatus(result?.status)}</td>
          `
          : '';

      return `
        <tr>
          <td>${this.escapeHtml(subject.name)}</td>
          ${periodScores.map((score) => `<td>${score}</td>`).join('')}
          ${finalCells}
        </tr>
      `;
    });

    return `
      <h2>Asignaturas académicas</h2>
      <table>
        <thead>
          <tr>
            <th>Asignatura</th>
            ${Array.from({ length: period }, (_, index) => `<th>P${index + 1}</th>`).join('')}
            ${period === 4 ? '<th>CF</th><th>CCF</th><th>CEXF</th><th>CEF</th><th>Estado</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    `;
  }

  private buildTechnicalSection(data: StudentReportData, period: number): string {
    const gradesBySubject = this.groupBy(data.technicalGrades, (grade) => grade.subjectId);

    if (!data.technicalResults.length && !data.technicalGrades.length) {
      return this.emptySection('Módulos técnicos', 'No hay calificaciones técnicas registradas.');
    }

    const rows = this.uniqueTechnicalSubjects(data).map((subject) => {
      const grades = gradesBySubject.get(subject.id) ?? [];
      const result = data.technicalResults.find((item) => item.subjectId === subject.id);
      const raCells = grades
        .map(
          (grade) =>
            `${this.escapeHtml(grade.learningOutcome.code)}: ${this.formatScore(grade.validScore)}`,
        )
        .join('<br />');
      const finalCells =
        period === 4
          ? `
            <td>${this.formatScore(result?.totalScore)}</td>
            <td>${this.formatScore(result?.finalScore)}</td>
            <td>${this.formatStatus(result?.status)}</td>
          `
          : '';

      return `
        <tr>
          <td>${this.escapeHtml(subject.name)}</td>
          <td>${raCells || '-'}</td>
          ${finalCells}
        </tr>
      `;
    });

    return `
      <h2>Módulos técnicos</h2>
      <table>
        <thead>
          <tr>
            <th>Módulo</th>
            <th>Resultados de aprendizaje</th>
            ${period === 4 ? '<th>Total</th><th>Final</th><th>Estado</th>' : ''}
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
            @page { size: letter; margin: 14mm; }
            * { box-sizing: border-box; }
            body { color: #111827; font-family: Arial, sans-serif; font-size: 11px; margin: 0; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            h2 { border-bottom: 1px solid #d1d5db; font-size: 14px; margin: 18px 0 8px; padding-bottom: 4px; }
            p { margin: 2px 0; }
            table { border-collapse: collapse; margin-top: 8px; width: 100%; }
            th, td { border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; font-weight: 700; }
            .report-page { break-after: page; min-height: 240mm; }
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
        printBackground: true,
        margin: {
          top: '14mm',
          right: '14mm',
          bottom: '14mm',
          left: '14mm',
        },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private calculateAcademicPeriodAverage(grades: AcademicGrade[], period: number): number | null {
    const scores = grades
      .map((grade) => this.academicValidPeriodScore(grade, period))
      .filter((score): score is number => score !== null);

    if (!scores.length) {
      return null;
    }

    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  }

  private academicValidPeriodScore(grade: AcademicGrade, period: number): number | null {
    const ordinary = this.toNumber(grade[`p${period}` as keyof AcademicGrade]);
    const recovery = this.toNumber(grade[`rp${period}` as keyof AcademicGrade]);

    if (ordinary === null) {
      return null;
    }

    return recovery ?? ordinary;
  }

  private uniqueAcademicSubjects(data: StudentReportData) {
    const subjects = [...data.academicResults.map((item) => item.subject)];

    for (const grade of data.academicGrades) {
      if (!subjects.some((subject) => subject.id === grade.subject.id)) {
        subjects.push(grade.subject);
      }
    }

    return subjects.sort((a, b) => a.name.localeCompare(b.name));
  }

  private uniqueTechnicalSubjects(data: StudentReportData) {
    const subjects = [...data.technicalResults.map((item) => item.subject)];

    for (const grade of data.technicalGrades) {
      if (!subjects.some((subject) => subject.id === grade.subject.id)) {
        subjects.push(grade.subject);
      }
    }

    return subjects.sort((a, b) => a.name.localeCompare(b.name));
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

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
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
