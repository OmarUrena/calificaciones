import type { UserRole } from "@/types/auth";

export type User = {
  id: string;
  schoolId?: string | null;
  teacherId?: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};
