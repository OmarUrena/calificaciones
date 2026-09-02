import type { Course } from "@/types/course";
import type { Student } from "@/types/student";
import type { Subject } from "@/types/subject";

export type SubjectStatus =
  | "PENDING"
  | "APPROVED"
  | "COMPLETIVA"
  | "EXTRAORDINARIA"
  | "SPECIAL"
  | "FAILED";

export const ACADEMIC_SCORE_FIELDS = [
  "p1",
  "rp1",
  "p2",
  "rp2",
  "p3",
  "rp3",
  "p4",
  "rp4",
] as const;

export type AcademicScoreField = (typeof ACADEMIC_SCORE_FIELDS)[number];
export type AcademicOrdinaryField = "p1" | "p2" | "p3" | "p4";
export type AcademicRecoveryField = "rp1" | "rp2" | "rp3" | "rp4";
export type ApiNumericValue = number | string | null;

export type AcademicScoreValues = Record<AcademicScoreField, number | null>;

export type AcademicGrade = {
  id: string;
  schoolId: string;
  schoolYearId: string;
  courseId: string;
  studentId: string;
  subjectId: string;
  blockNumber: number;
  p1: ApiNumericValue;
  rp1: ApiNumericValue;
  p2: ApiNumericValue;
  rp2: ApiNumericValue;
  p3: ApiNumericValue;
  rp3: ApiNumericValue;
  p4: ApiNumericValue;
  rp4: ApiNumericValue;
  pc: ApiNumericValue;
};

export type AcademicSubjectResult = {
  id: string;
  schoolId: string;
  schoolYearId: string;
  courseId: string;
  studentId: string;
  subjectId: string;
  pc1: ApiNumericValue;
  pc2: ApiNumericValue;
  pc3: ApiNumericValue;
  pc4: ApiNumericValue;
  cf: number | null;
  cec: number | null;
  ccf: number | null;
  ceex: number | null;
  cexf: number | null;
  ce: number | null;
  cef: number | null;
  status: SubjectStatus;
};

export type AcademicRegister = {
  course: Course;
  subject: Subject;
  students: Student[];
  grades: AcademicGrade[];
  results: AcademicSubjectResult[];
};

export type AcademicGradeSaveRow = {
  gradeId?: string;
  studentId: string;
  scores: AcademicScoreValues;
};

export type AcademicGradeSavePayload = {
  schoolId: string;
  schoolYearId: string;
  courseId: string;
  subjectId: string;
  blockNumber: number;
  rows: AcademicGradeSaveRow[];
};

export type AcademicFinalEvaluationValues = {
  cec: number | null;
  ceex: number | null;
  ce: number | null;
};

export type AcademicFinalEvaluationSaveRow = AcademicFinalEvaluationValues & {
  studentId: string;
};

export type AcademicGradeMutationResult = {
  grade: AcademicGrade;
  result: AcademicSubjectResult;
};
