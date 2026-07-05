export type TechnicalLearningOutcome = {
  id: string;
  schoolId: string;
  subjectId: string;
  code: string;
  name: string;
  weight: number | string;
  order: number;
  isActive: boolean;
};

export type TechnicalLearningOutcomeFormValues = {
  code: string;
  name: string;
  weight: number;
  order: number;
  isActive: boolean;
};
