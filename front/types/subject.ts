export type SubjectType = "ACADEMIC" | "TECHNICAL";

export type Subject = {
  id: string;
  schoolId: string;
  name: string;
  type: SubjectType;
  isActive: boolean;
};

export type SubjectFormValues = {
  name: string;
  type: SubjectType;
  isActive: boolean;
};
