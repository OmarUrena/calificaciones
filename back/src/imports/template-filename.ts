import { ImportTemplateDto } from './dto/import-template.dto';

const TEMPLATE_NAMES = {
  students: 'estudiantes',
  academic: 'academica',
  technical: 'tecnica',
} as const;

function filenamePart(value: string, fallback: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .slice(0, 80)
      .replace(/^-+|-+$/g, '') || fallback
  );
}

export function buildTemplateFilename(
  type: ImportTemplateDto['type'],
  courseName: string,
  subjectName: string,
): string {
  const parts = ['plantilla', TEMPLATE_NAMES[type], filenamePart(courseName, 'curso')];
  if (type !== 'students') parts.push(filenamePart(subjectName, 'asignatura'));
  return `${parts.join('-')}.xlsx`;
}
