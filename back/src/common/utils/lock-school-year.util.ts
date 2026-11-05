import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Grade writes and period changes must acquire this lock before reading periods.
export async function lockSchoolYear(
  tx: Prisma.TransactionClient,
  schoolId: string,
  schoolYearId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "school_years"
    WHERE "id" = ${schoolYearId} AND "schoolId" = ${schoolId}
    FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new NotFoundException('No se encontró el año escolar de la escuela.');
  }
}
