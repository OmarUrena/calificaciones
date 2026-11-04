import { BadRequestException } from '@nestjs/common';

export function ensureIntegerGrade(
  label: string,
  value: number | null | undefined,
  maximum = 100,
): void {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new BadRequestException(`${label} debe ser un número entero entre 0 y ${maximum}.`);
  }
}
