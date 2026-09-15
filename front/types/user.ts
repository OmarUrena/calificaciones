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

export type UserFormValues = {
  fullName: string;
  email: string;
  role: UserRole;
  schoolId: string | null;
  teacherId: string | null;
  isActive: boolean;
  password?: string;
};
