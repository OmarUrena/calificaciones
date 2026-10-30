// Build first, then run: node --test test/reports-cover.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { ReportsService } = require('../dist/src/reports/reports.service');

function fixture(id = 'one', listNumber = 1) {
  const subject = { id: 'math', name: 'Matemática', type: 'ACADEMIC', displayOrder: 10 };
  return {
    student: {
      id, firstName: `Ana ${id}`, lastName: 'Pérez & Díaz', listNumber,
      school: { id: 'school', name: 'Instituto Politécnico de Prueba', phone: '809-000-0000',
        educationalDistrict: '0804 Santiago Noroeste', province: 'Santiago', municipality: 'Santiago Oeste' },
      schoolYear: { name: '2026-2027' },
      course: { id: 'course', name: '6TO Grado del Bachillerato Técnico Desarrollo y Administración de Aplicaciones Informáticas',
        section: 'A', titular: { name: 'Docente de Prueba' } },
    },
    assignedSubjects: [subject], academicGrades: [], academicResults: [],
    technicalGrades: [], technicalResults: [], technicalLearningOutcomes: [],
  };
}

test('individual and course exports place each cover immediately after its grades', async () => {
  const first = fixture();
  const second = fixture('two', 2);
  const reports = new ReportsService({ course: { findUnique: async () => ({
    id: 'course', schoolId: 'school', students: [{ id: 'one' }, { id: 'two' }],
  }) } }, {}, { log: async () => {} }, { get: () => undefined });
  reports.getStudentReportData = async (id) => id === 'one' ? first : second;
  reports.ensureCanGenerateCourseReports = async () => {};
  let html;
  reports.renderPdf = async (document) => { html = document; return Buffer.from('%PDF'); };
  await reports.generateStudentReportCard('one', 2, { id: 'admin' });
  assert.equal((html.match(/<section class="report-page/g) || []).length, 2);
  await reports.generateCourseReportCards('course', 4, { id: 'admin' });
  assert.equal((html.match(/<section class="report-page/g) || []).length, 4);
  assert.ok(html.indexOf('Ana one') < html.indexOf('FIRMA DEL PADRE'));
  assert.ok(html.indexOf('FIRMA DEL PADRE') < html.indexOf('Ana two'));
});

test('cover and compact grades header fit the printed pages with escaped school data', async () => {
  const reports = new ReportsService({}, {}, {}, { get: () => undefined });
  const data = fixture();
  data.student.school.name = 'Instituto <Prueba> & Centro';
  // Typical full course: nine academic subjects and eight technical modules.
  data.assignedSubjects = Array.from({ length: 9 }, (_, i) => ({
    id: `academic-${i}`, name: `Asignatura ${i}`, type: 'ACADEMIC', displayOrder: i,
  })).concat(Array.from({ length: 8 }, (_, i) => ({
    id: `technical-${i}`, name: `Módulo ${i}`, type: 'TECHNICAL', displayOrder: 100 + i,
  })));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 980, height: 730 } });
    await page.emulateMedia({ media: 'print' });
    for (const period of [1, 2, 3, 4]) {
      const html = reports.buildDocumentHtml(reports.buildStudentReportPages(data, period));
      assert.match(html, /Instituto &lt;Prueba&gt; &amp; Centro/);
      await page.setContent(html);
      const layout = await page.evaluate(() => {
        const header = document.querySelector('.student-info');
        const children = [...header.children];
        const front = document.querySelector('.report-page');
        const cover = document.querySelector('.report-cover');
        return {
          headerLabels: children.map((element) => element.querySelector('strong').textContent),
          sameRow: children.every((element) => element.offsetTop === children[0].offsetTop),
          schoolOnFront: front.textContent.includes('Instituto <Prueba>'),
          coverFields: cover.textContent,
          frontHeight: front.getBoundingClientRect().height,
          coverHeight: cover.getBoundingClientRect().height,
          fitsWidth: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          summaries: front.querySelectorAll('.academic-summary').length,
        };
      });
      assert.deepEqual(layout.headerLabels, ['Estudiante:', 'Número de lista:', 'Curso:']);
      assert.equal(layout.sameRow, true);
      assert.equal(layout.schoolOnFront, false);
      assert.equal(layout.summaries, period === 4 ? 1 : 0);
      for (const text of ['OBSERVACIONES', 'Docente de Prueba', '0804 Santiago Noroeste', 'Santiago Oeste', '2026-2027']) {
        assert.ok(layout.coverFields.includes(text), text);
      }
      assert.ok(layout.frontHeight <= 740, `Front overflow P${period}: ${layout.frontHeight}`);
      assert.ok(layout.coverHeight <= 740, `Cover overflow P${period}: ${layout.coverHeight}`);
      assert.equal(layout.fitsWidth, true);
      const pdf = await page.pdf({ format: 'Letter', landscape: true, printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
      assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 2, `P${period} must print exactly two pages`);
    }
    if (process.env.REPORT_SCREENSHOT) {
      await page.locator('.report-cover').screenshot({ path: 'test-results/reports-cover.png' });
    }
    await page.setContent(reports.buildDocumentHtml([
      ...reports.buildStudentReportPages(data, 4),
      ...reports.buildStudentReportPages(fixture('two', 2), 4),
    ]));
    const coursePdf = await page.pdf({ format: 'Letter', landscape: true, printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
    assert.equal((coursePdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 4);
    data.student.school = { name: 'Centro sin datos opcionales' };
    data.student.course.titular = null;
    assert.doesNotThrow(() => reports.buildStudentCoverHtml(data));
    assert.doesNotMatch(reports.buildStudentCoverHtml(data), /undefined|null/);
  } finally {
    await browser.close();
  }
});
