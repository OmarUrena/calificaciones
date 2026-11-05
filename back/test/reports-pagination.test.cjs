// Build first, then: node --test test/reports-pagination.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { ReportsService } = require('../dist/src/reports/reports.service');

function fixture(academicCount = 9, technicalCount = 6) {
  const academic = Array.from({ length: academicCount }, (_, i) => ({
    id: `a${i}`,
    name: `Asignatura ${i + 1}: Lengua Española y Literatura`,
    type: 'ACADEMIC',
    displayOrder: i,
  }));
  const technical = Array.from({ length: technicalCount }, (_, i) => ({
    id: `t${i}`,
    name: `Módulo ${i + 1}: Análisis y Diseño de Sistemas Informáticos`,
    type: 'TECHNICAL',
    displayOrder: 100 + i,
  }));
  const outcomes = technical.flatMap((subject) =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `${subject.id}-ra${i}`,
      subjectId: subject.id,
      order: i + 1,
      code: `RA${i + 1}`,
      weight: 10,
      isActive: true,
    })),
  );
  return {
    student: {
      firstName: 'María Alejandra',
      lastName: 'Pérez Rodríguez',
      listNumber: 12,
      school: { name: 'Instituto de Educación Técnico Profesional', address: 'Santo Domingo' },
      schoolYear: { name: '2026-2027' },
      course: {
        name: '6to A Informática',
        grade: '6to',
        section: 'A',
        area: 'Informática',
        modality: 'Técnico Profesional',
        titular: { name: 'Docente titular' },
      },
    },
    assignedSubjects: [...academic, ...technical],
    academicGrades: academic.flatMap((subject) =>
      Array.from({ length: 4 }, (_, i) => ({
        subject,
        subjectId: subject.id,
        blockNumber: i + 1,
        p1: 100,
        rp1: 99.5,
        p2: 100,
        rp2: 99.5,
        p3: 100,
        rp3: 99.5,
        p4: 100,
        rp4: 99.5,
        pc: 100,
      })),
    ),
    academicResults: [],
    technicalResults: [],
    technicalLearningOutcomes: outcomes,
    technicalGrades: outcomes.map((outcome) => ({
      subjectId: outcome.subjectId,
      subject: technical.find((s) => s.id === outcome.subjectId),
      learningOutcomeId: outcome.id,
      learningOutcome: outcome,
      validScore: 9.5,
    })),
  };
}

test('P1–P4 keep readable, unwrapped scores and exactly two PDF pages per student', async () => {
  const reports = new ReportsService(
    {},
    {},
    {},
    {
      get: () => [
        'Comunicativa',
        'Pensamiento Lógico, Creativo y Crítico - Resolución de Problemas',
        'Científica y Tecnológica - Ambiental y de la Salud',
        'Ética y Ciudadana - Desarrollo Personal y Espiritual',
      ],
    },
  );
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const period of [1, 2, 3, 4]) {
      const html = reports.buildDocumentHtml([reports.buildStudentReportHtml(fixture(), period)]);
      await page.setContent(html);
      const layout = await page.evaluate(() => {
        const sheet = document.querySelector('.grades-page');
        const content = sheet.querySelector('.grades-content');
        const scores = [...sheet.querySelectorAll('td.numeric')];
        return {
          fits:
            content.scrollHeight <= sheet.clientHeight && content.scrollWidth <= sheet.clientWidth,
          scoresFit: scores.every((cell) => cell.scrollWidth <= cell.clientWidth),
          font: parseFloat(getComputedStyle(scores[0]).fontSize),
          summaries: sheet.querySelectorAll('.academic-summary').length,
        };
      });
      if (period < 4) assert.equal(layout.fits, true, `P${period} fits without shrinking`);
      assert.equal(layout.scoresFit, true, `P${period} scores fit their cells`);
      assert.ok(layout.font >= 10);
      assert.equal(layout.summaries, period === 4 ? 1 : 0);
      const pdf = await reports.renderPdf(html);
      assert.equal(
        (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length,
        2,
        `P${period} page count`,
      );
    }
    // Force the fitting fallback and verify that course reports preserve student boundaries.
    const html = reports.buildDocumentHtml([
      reports.buildStudentReportHtml(fixture(20, 12), 4),
      reports.buildStudentReportHtml(fixture(), 1),
    ]);
    const pdf = await reports.renderPdf(html);
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 4);
  } finally {
    await browser.close();
  }
});
