// Build first with npm run build, then run: node --test test/reports-academic.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { ReportsService } = require('../dist/src/reports/reports.service');

const blockTitles = [
  'Comunicativa',
  'Pensamiento Lógico, Creativo y Crítico - Resolución de Problemas',
  'Científica y Tecnológica - Ambiental y de la Salud',
  'Ética y Ciudadana - Desarrollo Personal y Espiritual',
];
const config = { get: (key) => (key === 'reports.academicBlockTitles' ? blockTitles : undefined) };
const subject = { id: 'math', name: 'Matemática & Lógica', displayOrder: 20 };
const grades = Array.from({ length: 4 }, (_, index) => {
  const blockNumber = index + 1;
  return {
    subjectId: subject.id,
    subject,
    blockNumber,
    p1: 10 + blockNumber,
    rp1: 20 + blockNumber,
    p2: 30 + blockNumber,
    rp2: null,
    p3: 50 + blockNumber,
    rp3: 60 + blockNumber,
    p4: 70 + blockNumber,
    rp4: null,
    pc: 80 + blockNumber / 10,
  };
});
const result = {
  subjectId: subject.id,
  subject,
  pc1: 80.1,
  pc2: 80.2,
  pc3: 80.3,
  pc4: 80.4,
  cf: 80,
  cec: 12,
  ccf: 92,
  ceex: null,
  cexf: null,
  ce: null,
  cef: 92,
  status: 'APPROVED',
};

function render(period) {
  const reports = new ReportsService({}, {}, {}, config);
  return reports.buildAcademicSection(
    {
      assignedSubjects: [],
      academicGrades: grades,
      academicResults: [result],
      technicalGrades: [],
      technicalResults: [],
    },
    period,
  );
}

test('academic report renders one row per subject with a real column for every grade', () => {
  const html = render(4);
  assert.match(html, /Matemática &amp; Lógica/);
  assert.match(html, /Comunicativa/);
  assert.match(html, /Pensamiento Lógico, Creativo y Crítico - Resolución de Problemas/);
  assert.match(html, /Científica y Tecnológica - Ambiental y de la Salud/);
  assert.match(html, /Ética y Ciudadana - Desarrollo Personal y Espiritual/);
  assert.doesNotMatch(html, /Bloque 1/);
  for (let period = 1; period <= 4; period++) {
    assert.match(html, new RegExp(`>P${period}<`));
    assert.match(html, new RegExp(`>RP${period}<`));
  }
  assert.match(html, /class="academic-detail period-4"/);
  assert.match(html, /colspan="8" class="competency-heading">Comunicativa/);
  assert.match(html, /Promedios por bloque y resultado final/);
  assert.match(html, />11</);
  assert.match(html, />21</);
  assert.match(html, />74</);
  for (const average of ['80.1', '80.2', '80.3', '80.4'])
    assert.match(html, new RegExp(`>${average}<`));
  for (const heading of ['CF', 'CEC', 'CCF', 'CEEX', 'CEXF', 'CE', 'CEF', 'Estado']) {
    assert.match(html, new RegExp(`>${heading}<`));
  }
  assert.match(html, />APPROVED</);
});

test('an earlier report period includes all blocks but does not reveal later grades or final averages', () => {
  const html = render(2);
  for (const title of blockTitles) {
    assert.match(html, new RegExp(title));
  }
  assert.match(html, />P1</);
  assert.match(html, />P2</);
  assert.doesNotMatch(html, />P3</);
  assert.doesNotMatch(html, />51</);
  assert.doesNotMatch(html, />71</);
  assert.doesNotMatch(html, />80\.1</);
  assert.doesNotMatch(html, />CF</);
  assert.doesNotMatch(html, />APPROVED</);
});

test('academic section still handles a report with no academic grades', () => {
  const reports = new ReportsService({}, {}, {}, config);
  const html = reports.buildAcademicSection(
    {
      assignedSubjects: [],
      academicGrades: [],
      academicResults: [],
      technicalGrades: [],
      technicalResults: [],
    },
    4,
  );
  assert.match(html, /No hay calificaciones académicas registradas/);
});

test('assigned course subjects appear even when the student has no grades', async () => {
  const academicSubject = {
    id: 'language',
    schoolId: 'school-1',
    name: 'Lengua Española',
    type: 'ACADEMIC',
    displayOrder: 10,
    isActive: true,
  };
  const technicalSubject = {
    id: 'systems',
    schoolId: 'school-1',
    name: 'Análisis y Diseño de Sistemas',
    type: 'TECHNICAL',
    displayOrder: 1000,
    isActive: true,
  };
  let assignmentQuery;
  const prisma = {
    student: {
      findUnique: async () => ({
        id: 'student-1',
        schoolId: 'school-1',
        schoolYearId: 'year-1',
        courseId: 'course-1',
      }),
    },
    teacherAssignment: {
      findMany: async (query) => {
        assignmentQuery = query;
        return [{ subject: academicSubject }, { subject: technicalSubject }];
      },
    },
    academicSubjectResult: { findMany: async () => [] },
    academicGrade: { findMany: async () => [] },
    technicalSubjectResult: { findMany: async () => [] },
    technicalGrade: { findMany: async () => [] },
    technicalLearningOutcome: { findMany: async () => [] },
  };
  const reports = new ReportsService(prisma, {}, {}, config);
  const data = await reports.getStudentReportData('student-1');

  assert.deepEqual(assignmentQuery.where, {
    schoolId: 'school-1',
    schoolYearId: 'year-1',
    courseId: 'course-1',
    isActive: true,
  });
  assert.deepEqual(data.assignedSubjects, [academicSubject, technicalSubject]);

  const academicHtml = reports.buildAcademicSection(data, 4);
  assert.match(academicHtml, /Lengua Española/);
  assert.doesNotMatch(academicHtml, /No hay calificaciones académicas registradas/);
  assert.match(academicHtml, /<td class="numeric">-<\/td>/);

  const technicalHtml = reports.buildTechnicalSection(data, 4);
  assert.match(technicalHtml, /Análisis y Diseño de Sistemas/);
  assert.doesNotMatch(technicalHtml, /No hay calificaciones técnicas registradas/);
  assert.match(technicalHtml, /<td>-<\/td>/);
});

test('academic subjects follow their global display order', () => {
  const reports = new ReportsService({}, {}, {}, config);
  const orderedSubjects = [
    { id: 'physical', name: 'Educación Física', type: 'ACADEMIC', displayOrder: 70 },
    { id: 'spanish', name: 'Lengua Española', type: 'ACADEMIC', displayOrder: 10 },
    { id: 'french', name: 'Francés', type: 'ACADEMIC', displayOrder: 60 },
    { id: 'english', name: 'Inglés', type: 'ACADEMIC', displayOrder: 50 },
  ];
  const html = reports.buildAcademicSection(
    {
      assignedSubjects: orderedSubjects,
      academicGrades: [],
      academicResults: [],
      technicalGrades: [],
      technicalResults: [],
    },
    4,
  );

  assert.ok(html.indexOf('Lengua Española') < html.indexOf('Inglés'));
  assert.ok(html.indexOf('Inglés') < html.indexOf('Francés'));
  assert.ok(html.indexOf('Francés') < html.indexOf('Educación Física'));
});

test('technical report renders flexible RA columns with score and weight', async () => {
  const reports = new ReportsService({}, {}, {}, config);
  const moduleOne = {
    id: 'module-1',
    name: 'Ofimática',
    type: 'TECHNICAL',
    displayOrder: 100,
  };
  const moduleTwo = {
    id: 'module-2',
    name: 'Sistema de Salud',
    type: 'TECHNICAL',
    displayOrder: 110,
  };
  const ra1 = {
    id: 'ra-1',
    subjectId: moduleOne.id,
    code: 'RA1',
    name: 'Primer resultado',
    weight: 20,
    order: 1,
    isActive: true,
  };
  const ra2 = {
    id: 'ra-2',
    subjectId: moduleOne.id,
    code: 'RA2',
    name: 'Segundo resultado',
    weight: 30,
    order: 2,
    isActive: true,
  };
  const ra10 = {
    id: 'ra-10',
    subjectId: moduleTwo.id,
    code: 'RA10',
    name: 'Décimo resultado',
    weight: 25,
    order: 10,
    isActive: true,
  };
  const html = reports.buildTechnicalSection(
    {
      assignedSubjects: [moduleTwo, moduleOne],
      academicGrades: [],
      academicResults: [],
      technicalGrades: [
        {
          subjectId: moduleOne.id,
          subject: moduleOne,
          learningOutcomeId: ra1.id,
          learningOutcome: ra1,
          validScore: 18,
        },
      ],
      technicalLearningOutcomes: [ra10, ra2, ra1],
      technicalResults: [],
    },
    4,
  );

  assert.match(html, /<th class="numeric">RA1<\/th>/);
  assert.match(html, /<th class="numeric">RA2<\/th>/);
  assert.match(html, /<th class="numeric">RA10<\/th>/);
  assert.match(html, />18\/20<\/td>/);
  assert.match(html, />-\/30<\/td>/);
  assert.match(html, />-\/25<\/td>/);
  assert.ok(html.indexOf('Ofimática') < html.indexOf('Sistema de Salud'));

  const documentHtml = reports.buildDocumentHtml([
    `<section class="report-page">${html}</section>`,
  ]);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1056, height: 816 } });
    await page.setContent(documentHtml);
    if (process.env.REPORT_SCREENSHOT) {
      await page.screenshot({ path: 'test-results/reports-technical-layout.png', fullPage: true });
    }
    const layout = await page.evaluate(() => {
      const table = document.querySelector('.technical-grid');
      return {
        headers: table.querySelectorAll('thead th').length,
        rows: table.querySelectorAll('tbody tr').length,
        firstRowCells: table.querySelectorAll('tbody tr:first-child td').length,
        fits: table.getBoundingClientRect().width <= document.body.getBoundingClientRect().width,
      };
    });
    assert.deepEqual(layout, { headers: 14, rows: 2, firstRowCells: 14, fits: true });
  } finally {
    await browser.close();
  }
});

test('the complete academic tables fit the printable page width', async () => {
  const reports = new ReportsService({}, {}, {}, config);
  const section = render(4);
  const html = reports.buildDocumentHtml([`<section class="report-page">${section}</section>`]);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1056, height: 816 } });
    await page.setContent(html);
    const layout = await page.evaluate(() => ({
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      detailRows: document.querySelectorAll('.academic-detail tbody tr').length,
      detailCells: document.querySelectorAll('.academic-detail tbody td').length,
      summaryRows: document.querySelectorAll('.academic-summary tbody tr').length,
      summaryCells: document.querySelectorAll('.academic-summary tbody td').length,
      detailWidth: document.querySelector('.academic-detail').getBoundingClientRect().width,
      summaryWidth: document.querySelector('.academic-summary').getBoundingClientRect().width,
      bodyWidth: document.body.getBoundingClientRect().width,
    }));
    if (process.env.REPORT_SCREENSHOT) {
      await page.screenshot({ path: 'test-results/reports-academic-layout.png', fullPage: true });
    }
    assert.equal(layout.documentFits, true);
    assert.equal(layout.detailRows, 1);
    assert.equal(layout.detailCells, 33);
    assert.equal(layout.summaryRows, 1);
    assert.equal(layout.summaryCells, 13);
    assert.ok(layout.detailWidth <= layout.bodyWidth);
    assert.ok(layout.summaryWidth <= layout.bodyWidth);
  } finally {
    await browser.close();
  }
});
