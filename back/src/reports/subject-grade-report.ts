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
    | { type: 'ACADEMIC'; period: number; grades: AcademicGrade[]; blockTitles: string[] }
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
  period?: number,
): string {
  const part = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .slice(0, 80)
      .replace(/^-+|-+$/g, '') || 'registro';
  return `calificaciones-${part(course)}-${part(subject)}-${period ? `P${period}` : 'por-RA'}.pdf`;
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
    `<colgroup><col class="list-column" /><col class="student-column" />${'<col />'.repeat(numericCount)}</colgroup>`;

  if (data.type === 'ACADEMIC') {
    const period = data.period as 1 | 2 | 3 | 4;
    const grades = new Map(
      data.grades.map((grade) => [`${grade.studentId}:${grade.blockNumber}`, grade]),
    );
    for (const students of chunks(data.students, 20)) {
      const rows = students
        .map(
          (student) =>
            `<tr>${identityCells(student)}${[1, 2, 3, 4]
              .map((block) => {
                const grade = grades.get(`${student.id}:${block}`);
                return `<td>${score(grade?.[`p${period}`])}</td><td class="recovery">${score(grade?.[`rp${period}`])}</td>`;
              })
              .join('')}</tr>`,
        )
        .join('');
      pages.push(`${header(`Período P${period} · Notas ordinarias y recuperación de los cuatro bloques`)}
        <table>${columns(8)}<thead><tr><th rowspan="2">No.</th><th rowspan="2">Estudiante</th>
        ${[1, 2, 3, 4].map((block) => `<th colspan="2">Bloque ${block}<br /><span>${escape(data.blockTitles[block - 1])}</span></th>`).join('')}
        </tr><tr>${`<th>P${period}</th><th>RP${period}</th>`.repeat(4)}</tr></thead>
        <tbody>${rows || '<tr><td colspan="10">No hay estudiantes registrados en este curso.</td></tr>'}</tbody></table>`);
    }
  } else {
    const grades = new Map(
      data.grades.map((grade) => [`${grade.studentId}:${grade.learningOutcomeId}`, grade]),
    );
    for (const outcomes of chunks(data.outcomes, 3)) {
      for (const students of chunks(data.students, 20)) {
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
        pages.push(`${header('Registro completo por RA · O: ordinaria · R1/R2: recuperaciones · ESP: especial · V: nota válida')}
          <table>${columns(outcomes.length * 5)}<thead><tr><th rowspan="2">No.</th><th rowspan="2">Estudiante</th>
          ${outcomes.map((outcome) => `<th colspan="5">${escape(outcome.code)} · Peso: ${score(outcome.weight)}<br /><span>${escape(outcome.name)}</span></th>`).join('')}
          </tr><tr>${'<th>O</th><th>R1</th><th>R2</th><th>ESP</th><th>V</th>'.repeat(outcomes.length)}</tr></thead>
          <tbody>${rows || `<tr><td colspan="${2 + outcomes.length * 5}">No hay estudiantes registrados en este curso.</td></tr>`}</tbody></table>`);
      }
    }
  }

  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Registro de calificaciones</title>
    <style>
      @page { size: letter landscape; margin: 10mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #173a63; }
      .page { break-after: page; } .page:last-child { break-after: auto; }
      h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 0 0 8px; }
      .identity { display: flex; flex-wrap: wrap; gap: 8px 24px; }
      .detail { background: #e8f1fc; padding: 8px; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #bccbda; padding: 5px 3px; text-align: center; overflow-wrap: anywhere; }
      th { background: #e8f1fc; font-size: 10px; } th span { font-weight: normal; font-size: 9px; }
      td { color: #111827; } .student { text-align: left; } .list-column { width: 36px; } .student-column { width: 190px; }
      .recovery { background: #fff8e8; } thead { display: table-header-group; } tr { break-inside: avoid; }
      footer { margin-top: 8px; color: #64748b; font-size: 10px; } .empty { padding: 16px; border: 1px solid #bccbda; }
    </style></head><body>${pages.map((page) => `<section class="page">${page}<footer>—: sin calificación registrada</footer></section>`).join('')}</body></html>`;
}
