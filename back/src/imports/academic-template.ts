import { Worksheet } from 'exceljs';

const ORDINARY_FILL = 'FFE8F1FC';
const RECOVERY_FILL = 'FFFFF1D6';
const ORDINARY_HEADER = 'FFD5E7FA';
const RECOVERY_HEADER = 'FFFFDE9E';
const GROUP_FILLS = ['FF173A63', 'FF24527F', 'FF173A63', 'FF24527F'];
const BORDER = 'FFB8C8D8';

export const ACADEMIC_TEMPLATE_HEADERS = [
  'numero_lista',
  ...[1, 2, 3, 4].flatMap((block) =>
    [1, 2, 3, 4].flatMap((period) => [`B${block}_P${period}`, `B${block}_RP${period}`]),
  ),
  'CEC',
  'CEEX',
  'CE',
];

export function formatAcademicTemplate(
  sheet: Worksheet,
  courseName: string,
  subjectName: string,
  listNumbers: number[],
) {
  sheet.getCell('A1').value = 'Curso';
  sheet.getCell('B1').value = courseName;
  sheet.getCell('A2').value = 'Asignatura';
  sheet.getCell('B2').value = subjectName;
  for (const rowNumber of [1, 2]) {
    const row = sheet.getRow(rowNumber);
    row.height = 25;
    row.getCell(1).font = { bold: true, color: { argb: 'FF173A63' } };
    row.getCell(2).font = { bold: true, color: { argb: 'FF173A63' }, size: 12 };
    row.getCell(1).alignment = { vertical: 'middle' };
    row.getCell(2).alignment = { vertical: 'middle' };
  }

  sheet.mergeCells(3, 2, 3, 9);
  sheet.mergeCells(3, 10, 3, 17);
  sheet.mergeCells(3, 18, 3, 25);
  sheet.mergeCells(3, 26, 3, 33);
  sheet.mergeCells(3, 34, 3, 36);
  sheet.getCell('A3').value = 'Estudiante';
  sheet.getCell('A3').fill = solid('FF173A63');
  sheet.getCell('A3').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
  [2, 10, 18, 26].forEach((column, index) => {
    const cell = sheet.getRow(3).getCell(column);
    cell.value = `Bloque de competencia ${index + 1}`;
    cell.fill = solid(GROUP_FILLS[index]);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  const finalGroup = sheet.getCell('AH3');
  finalGroup.value = 'Evaluaciones finales';
  finalGroup.fill = solid('FF50637B');
  finalGroup.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  finalGroup.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 31;

  ACADEMIC_TEMPLATE_HEADERS.forEach((header, index) => {
    const columnNumber = index + 1;
    const column = sheet.getColumn(columnNumber);
    column.width = columnNumber === 1 ? 16 : columnNumber >= 34 ? 14 : 13;
    const cell = sheet.getRow(4).getCell(columnNumber);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FF173A63' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = solid(
      columnNumber === 1
        ? 'FFD8E1EC'
        : columnNumber >= 34
          ? 'FFE2E7EE'
          : columnNumber % 2 === 0
            ? ORDINARY_HEADER
            : RECOVERY_HEADER,
    );
    cell.border = columnBorder(columnNumber);
  });
  sheet.getRow(4).height = 28;

  listNumbers.forEach((number, index) => {
    const row = sheet.getRow(index + 5);
    row.getCell(1).value = number;
    row.height = 23;
    for (
      let columnNumber = 1;
      columnNumber <= ACADEMIC_TEMPLATE_HEADERS.length;
      columnNumber += 1
    ) {
      const cell = row.getCell(columnNumber);
      cell.fill = solid(
        columnNumber === 1
          ? 'FFF1F4F8'
          : columnNumber >= 34
            ? 'FFF1F3F6'
            : columnNumber % 2 === 0
              ? ORDINARY_FILL
              : RECOVERY_FILL,
      );
      cell.border = columnBorder(columnNumber);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (columnNumber > 1) cell.numFmt = '0.##';
    }
  });

  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(5, listNumbers.length + 4), column: ACADEMIC_TEMPLATE_HEADERS.length },
  };
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:4',
  };
}

function solid(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
}

function columnBorder(columnNumber: number) {
  const groupStart = [2, 10, 18, 26, 34].includes(columnNumber);
  return {
    left: { style: groupStart ? ('medium' as const) : ('hair' as const), color: { argb: BORDER } },
    right: { style: 'hair' as const, color: { argb: BORDER } },
    bottom: { style: 'hair' as const, color: { argb: BORDER } },
  };
}
