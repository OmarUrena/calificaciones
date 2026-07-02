import type { Course } from "@/types/course";
import type { SchoolYear } from "@/types/school-year";

export type Student = {
  id: string;
  schoolId: string;
  schoolYearId: string;
  courseId: string;
  listNumber: number;
  firstName: string;
  lastName: string;
  course?: Course;
  schoolYear?: SchoolYear;
};

export type StudentFormValues = {
  listNumber: number;
  firstName: string;
  lastName: string;
  courseId: string;
};
