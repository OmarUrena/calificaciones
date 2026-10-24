import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function rethrowKnownPrismaError(
  error: unknown,
  uniqueConflictMessage = 'A record with the same unique fields already exists.',
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException(uniqueConflictMessage);
  }

  throw error;
}
