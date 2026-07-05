import type { Course } from "@/types/course";
import type { SchoolYear } from "@/types/school-year";
import type { Subject } from "@/types/subject";
import type { Teacher } from "@/types/teacher";

export type TeacherAssignment = {
  id: string;
  schoolId: string;
  schoolYearId: string;
  teacherId: string;
  subjectId: string;
  courseId: string;
  isActive: boolean;
  teacher?: Teacher;
  subject?: Subject;
  course?: Course;
  schoolYear?: SchoolYear;
};

export type TeacherAssignmentFormValues = {
  schoolYearId: string;
  courseId: string;
  subjectId: string;
  teacherId: string;
  isActive: boolean;
};
