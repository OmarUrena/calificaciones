// Build the backend first, then run this script to generate a sample without using the database.
const fs = require('node:fs');
const path = require('node:path');
const { ImportsService } = require('../dist/src/imports/imports.service');

async function main() {
  const target = process.argv[2] ?? path.resolve(__dirname, '../../artifacts/plantilla-tecnica-14-ra.xlsx');
  const outcomes = Array.from({ length: 14 }, (_, index) => ({ code: `RA${index + 1}` }));
  const prisma = {
    course: { findFirst: async () => ({ id: 'preview-course', schoolId: 'preview-school', schoolYearId: 'preview-year', name: '6to A' }) },
    teacherAssignment: { findFirst: async () => ({ subject: { name: 'Desarrollo e implementación de soluciones de software' } }) },
    technicalLearningOutcome: { findMany: async () => outcomes },
    student: { findMany: async () => Array.from({ length: 20 }, (_, index) => ({ listNumber: index + 1 })) },
  };
  const permissions = { ensureCanAccessSchool() {}, async ensureTeacherCanManageSubject() {} };
  const service = new ImportsService(prisma, permissions, {}, {}, {});
  const buffer = await service.generateTemplate({
    type: 'technical', courseId: 'preview-course', schoolYearId: 'preview-year', subjectId: 'preview-subject',
  }, { id: 'preview-admin', schoolId: 'preview-school', role: 'ADMIN' });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  console.log(`Sample: ${target} (14 RA, 20 students, ${buffer.length} bytes)`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
