export type SchoolYear = {
  id: string;
  schoolId: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SchoolYearFormValues = {
  name: string;
  isActive: boolean;
};
