import type {
  AcademicGrade,
  Student,
  TechnicalGrade,
  TechnicalLearningOutcome,
} from '@prisma/client';

type ReportIdentity = {
  school: string;
  schoolYear: string;
  course: string;
  subject: string;
  teacher: string;
  students: Pick<Student, 'id' | 'listNumber' | 'firstName' | 'lastName'>[];
};

export type SubjectGradeReportData = ReportIdentity &
  (
    | {
        type: 'ACADEMIC';
        period?: number;
        periods?: number[];
        grades: AcademicGrade[];
        blockTitles: string[];
      }
    | { type: 'TECHNICAL'; grades: TechnicalGrade[]; outcomes: TechnicalLearningOutcome[] }
  );

function escape(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
}

function score(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  return Number.isFinite(number) ? escape(String(number)) : '—';
}

function chunks<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export function subjectGradeReportFilename(
  course: string,
  subject: string,
  period?: number | number[],
  outcomeCodes?: string[],
): string {
  const part = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .slice(0, 60)
      .replace(/^-+|-+$/g, '') || 'registro';
  const suffix = Array.isArray(period)
    ? period.map((value) => `P${value}`).join('-')
    : period
      ? `P${period}`
      : outcomeCodes?.length
        ? part(outcomeCodes.join('-'))
        : 'por-RA';
  return `calificaciones-${part(course)}-${part(subject)}-${suffix}.pdf`;
}

export function buildSubjectGradeReportHtml(data: SubjectGradeReportData): string {
  const pages: string[] = [];
  const header = (detail: string) => `
    <header><h1>${escape(data.school)}</h1><h2>Registro de calificaciones · ${escape(data.subject)}</h2>
      <div class="identity"><span><strong>Curso:</strong> ${escape(data.course)}</span>
        <span><strong>Año escolar:</strong> ${escape(data.schoolYear)}</span>
        <span><strong>Docente:</strong> ${escape(data.teacher)}</span></div>
      <p class="detail">${detail}</p></header>`;
  const identityCells = (student: ReportIdentity['students'][number]) =>
    `<td class="number">${student.listNumber}</td><td class="student">${escape(`${student.firstName} ${student.lastName}`)}</td>`;
  const columns = (numericCount: number) =>
    `<colgroup><col class="list-column" /><col class="student-column" />${'<col class="score-column" />'.repeat(numericCount)}</colgroup>`;

  if (data.type === 'ACADEMIC') {
    const periods = data.periods ?? [data.period ?? 1];
    const grades = new Map(
      data.grades.map((grade) => [`${grade.studentId}:${grade.blockNumber}`, grade]),
    );
    for (const selectedPeriods of chunks(periods, 2)) {
      for (const students of chunks(data.students, 30)) {
        const rows = students
          .map(
            (student) =>
              `<tr>${identityCells(student)}${[1, 2, 3, 4]
                .map((block) => {
                  const grade = grades.get(`${student.id}:${block}`);
                  return selectedPeriods
                    .map((value) => {
                      const period = value as 1 | 2 | 3 | 4;
                      return `<td>${score(grade?.[`p${period}`])}</td><td class="recovery">${score(grade?.[`rp${period}`])}</td>`;
                    })
                    .join('');
                })
                .join('')}</tr>`,
          )
          .join('');
        pages.push(`${header(`Períodos: ${selectedPeriods.map((value) => `P${value}`).join(', ')} · Ordinarias y recuperación`)}
        <table>${columns(selectedPeriods.length * 8)}<thead><tr><th rowspan="2">No.</th><th rowspan="2">Estudiante</th>
        ${[1, 2, 3, 4].map((block) => `<th colspan="${selectedPeriods.length * 2}">Bloque ${block}<br /><span>${escape(data.blockTitles[block - 1])}</span></th>`).join('')}
        </tr><tr>${selectedPeriods
          .map((period) => `<th>P${period}</th><th>RP${period}</th>`)
          .join('')
          .repeat(4)}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${2 + selectedPeriods.length * 8}">No hay estudiantes registrados en este curso.</td></tr>`}</tbody></table>`);
      }
    }
  } else {
    const grades = new Map(
      data.grades.map((grade) => [`${grade.studentId}:${grade.learningOutcomeId}`, grade]),
    );
    for (const outcomes of chunks(data.outcomes, 4)) {
      for (const students of chunks(data.students, 30)) {
        if (outcomes.length === 0) {
          pages.push(
            `${header('Registro completo por resultados de aprendizaje (RA)')}<p class="empty">No hay RA registrados para esta asignatura.</p>`,
          );
          break;
        }
        const rows = students
          .map(
            (student) =>
              `<tr>${identityCells(student)}${outcomes
                .map((outcome) => {
                  const grade = grades.get(`${student.id}:${outcome.id}`);
                  return [
                    'ordinaryScore',
                    'recovery1Score',
                    'recovery2Score',
                    'specialScore',
                    'validScore',
                  ]
                    .map((field) => `<td>${score(grade?.[field as keyof TechnicalGrade])}</td>`)
                    .join('');
                })
                .join('')}</tr>`,
          )
          .join('');
        pages.push(`${header('RA seleccionados · O: ordinaria · R1/R2: recuperaciones · ESP: especial · V: nota válida')}
          <table>${columns(outcomes.length * 5)}<thead><tr><th rowspan="2">No.</th><th rowspan="2">Estudiante</th>
          ${outcomes.map((outcome) => `<th colspan="5">${escape(outcome.code)} · Peso: ${score(outcome.weight)}<br /><span>${escape(outcome.name)}</span></th>`).join('')}
          </tr><tr>${'<th>O</th><th>R1</th><th>R2</th><th>ESP</th><th>V</th>'.repeat(outcomes.length)}</tr></thead>
          <tbody>${rows || `<tr><td colspan="${2 + outcomes.length * 5}">No hay estudiantes registrados en este curso.</td></tr>`}</tbody></table>`);
      }
    }
  }

  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Registro de calificaciones</title>
    <style>
      @page { size: letter portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; font-size: 10px; color: #173a63; }
      .page { break-after: page; } .page:last-child { break-after: auto; }
      h1 { font-size: 15px; margin: 0 0 4px; } h2 { font-size: 12px; margin: 0 0 8px; }
      .identity { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 9px; }
      .detail { background: #e8f1fc; padding: 4px; margin: 8px 0; font-size: 9px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #bccbda; padding: 3px 1px; text-align: center; overflow-wrap: anywhere; }
      th { background: #e8f1fc; font-size: 8px; line-height: 1.15; } th span { font-weight: normal; font-size: 7px; }
      td { color: #111827; font-size: 9px; } .student { text-align: left; font-size: 10px; }
      .list-column { width: 5mm; } .score-column { width: 7mm; }
      .recovery { background: #fff8e8; } thead { display: table-header-group; } tr { break-inside: avoid; }
      footer { margin-top: 8px; color: #64748b; font-size: 8px; } .empty { padding: 16px; border: 1px solid #bccbda; }
    </style></head><body>${pages.map((page) => `<section class="page">${page}<footer>—: sin calificación registrada</footer></section>`).join('')}</body></html>`;
}
