import type { SchoolYear } from "@/types/school-year";
import type { Teacher } from "@/types/teacher";

export type Course = {
  id: string;
  schoolId: string;
  schoolYearId: string;
  name: string;
  grade: string;
  section?: string | null;
  area?: string | null;
  modality?: string | null;
  titularId?: string | null;
  schoolYear?: SchoolYear;
  titular?: Teacher | null;
};

export type CourseFormValues = {
  name: string;
  grade: string;
  section?: string;
  area?: string;
  modality?: string;
  schoolYearId: string;
  titularId?: string;
};
