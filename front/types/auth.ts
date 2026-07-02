export type UserRole = "SUPER_ADMIN" | "ADMIN" | "TEACHER";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive?: boolean;
  schoolId?: string | null;
  teacherId?: string | null;
  school?: {
    id: string;
    name: string;
  } | null;
  activeSchoolYear?: {
    id: string;
    name: string;
  } | null;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  user: CurrentUser;
};
