const fs = require('node:fs');
const path = require('node:path');
const { Workbook } = require('exceljs');
const { ImportsService } = require('../dist/src/imports/imports.service');

async function main() {
  const sourcePath = process.argv[2];
  const targetPath = process.argv[3];
  if (!sourcePath || !targetPath) throw new Error('Indica el archivo de ejemplo y la ruta de salida.');

  const reference = new Workbook();
  await reference.xlsx.readFile(sourcePath);
  const source = reference.getWorksheet('Datos') ?? reference.worksheets[0];
  const courseName = String(source.getCell('B1').value ?? 'Curso de ejemplo');
  const subjectName = String(source.getCell('B2').value ?? 'Asignatura de ejemplo');
  const listNumbers = [];
  for (let rowNumber = 5; rowNumber <= source.rowCount; rowNumber += 1) {
    const value = source.getRow(rowNumber).getCell(1).value;
    if (typeof value === 'number') listNumbers.push({ listNumber: value });
  }

  const prisma = {
    course: { findFirst: async () => ({ id: 'preview-course', schoolId: 'preview-school', schoolYearId: 'preview-year', name: courseName }) },
    teacherAssignment: { findFirst: async () => ({ subject: { id: 'preview-subject', name: subjectName } }) },
    student: { findMany: async () => listNumbers },
  };
  const permissions = { ensureCanAccessSchool() {}, ensureTeacherCanManageSubject: async () => {} };
  const service = new ImportsService(prisma, permissions, {}, {}, {});
  const buffer = await service.generateTemplate({
    type: 'academic', courseId: 'preview-course', schoolYearId: 'preview-year', subjectId: 'preview-subject',
  }, { id: 'preview-user', role: 'ADMIN', schoolId: 'preview-school' });

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  console.log(`${targetPath} (${listNumbers.length} estudiantes, ${buffer.length} bytes)`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
