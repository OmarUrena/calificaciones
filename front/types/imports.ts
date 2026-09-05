export type ImportType = "students" | "academic" | "technical";

export type ImportSelection = {
  type: ImportType;
  schoolYearId: string;
  courseId: string;
  subjectId?: string;
};

export type ImportSummary = {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: string[];
};
