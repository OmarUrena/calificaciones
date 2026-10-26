import { Worksheet } from 'exceljs';

export const MAX_TECHNICAL_TEMPLATE_OUTCOMES = 14;

const GROUP_COLORS = [
  '173A63',
  '24527F',
  '26656B',
  '4C527F',
  '6C526A',
  '775B36',
  '3B6651',
  '405A76',
  '3A626F',
  '5E557A',
  '705363',
  '6A633B',
  '426463',
  '4E5F78',
];
const ATTEMPTS = ['Ordinaria', 'Recuperación 1', 'Recuperación 2', 'Especial'];

export function formatTechnicalTemplate(
  sheet: Worksheet,
  courseName: string,
  subjectName: string,
  listNumbers: number[],
  outcomes: Array<{ code: string; name?: string }>,
) {
  const lastColumn = 1 + outcomes.length * 4;
  sheet.getColumn(1).width = 16;
  for (const [index, value] of [courseName, subjectName].entries()) {
    const row = sheet.getRow(index + 1);
    row.height = 28;
    row.getCell(1).value = index === 0 ? 'Curso' : 'Asignatura';
    row.getCell(2).value = value;
    sheet.mergeCells(index + 1, 2, index + 1, Math.min(9, lastColumn));
    for (const column of [1, 2]) {
      row.getCell(column).font = { bold: true, color: { argb: 'FF173A63' }, size: 12 };
      row.getCell(column).alignment = { vertical: 'middle', wrapText: true };
    }
  }

  sheet.getCell('A3').value = 'Estudiante';
  sheet.getCell('A3').fill = solid('FF173A63');
  sheet.getCell('A3').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A4').value = 'numero_lista';
  sheet.getCell('A4').fill = solid('FFD8E1EC');
  sheet.getCell('A4').font = { bold: true, color: { argb: 'FF173A63' } };
  sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 31;
  sheet.getRow(4).height = 28;

  outcomes.forEach(({ code, name }, index) => {
    const firstColumn = 2 + index * 4;
    const color = GROUP_COLORS[index];
    sheet.mergeCells(3, firstColumn, 3, firstColumn + 3);
    const group = sheet.getRow(3).getCell(firstColumn);
    group.value = code;
    group.fill = solid(`FF${color}`);
    group.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    group.alignment = { horizontal: 'center', vertical: 'middle' };
    if (name) group.note = name;

    [code, `${code}_R1`, `${code}_R2`, `${code}_ESP`].forEach((header, attempt) => {
      const column = firstColumn + attempt;
      sheet.getColumn(column).width = 14;
      const cell = sheet.getRow(4).getCell(column);
      cell.value = header;
      cell.note = `${code}: ${ATTEMPTS[attempt]}`;
      cell.font = { bold: true, color: { argb: 'FF173A63' } };
      cell.fill = solid(tint(color, 0.8 - attempt * 0.05));
      cell.border = columnBorder(attempt, color);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      listNumbers.forEach((_, rowIndex) => {
        const data = sheet.getRow(rowIndex + 5).getCell(column);
        data.fill = solid(tint(color, 0.94 - attempt * 0.06));
        data.border = columnBorder(attempt, color);
        data.alignment = { horizontal: 'center', vertical: 'middle' };
        data.numFmt = '0.##';
      });
    });
  });

  listNumbers.forEach((number, index) => {
    const row = sheet.getRow(index + 5);
    row.height = 23;
    const cell = row.getCell(1);
    cell.value = number;
    cell.fill = solid('FFF1F4F8');
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = columnBorder(3, 'B8C8D8');
  });

  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(5, listNumbers.length + 4), column: lastColumn },
  };
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:4',
    printTitlesColumn: 'A:A',
  };
}

function solid(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
}

function tint(color: string, white: number): string {
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16);
    return Math.round(channel + (255 - channel) * white)
      .toString(16)
      .padStart(2, '0');
  });
  return `FF${channels.join('').toUpperCase()}`;
}

function columnBorder(attempt: number, color: string) {
  return {
    left: {
      style: attempt === 0 ? ('medium' as const) : ('hair' as const),
      color: { argb: `FF${color}` },
    },
    right: {
      style: attempt === 3 ? ('medium' as const) : ('hair' as const),
      color: { argb: `FF${color}` },
    },
    bottom: { style: 'hair' as const, color: { argb: 'FFB8C8D8' } },
  };
}
