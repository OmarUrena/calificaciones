import { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  schoolId: string | null;
  teacherId: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};
