export type AcademicPeriods = {
  p1Enabled: boolean;
  rp1Enabled: boolean;
  p2Enabled: boolean;
  rp2Enabled: boolean;
  p3Enabled: boolean;
  rp3Enabled: boolean;
  p4Enabled: boolean;
  rp4Enabled: boolean;
};

export const ACADEMIC_PERIODS = [
  { key: "p1Enabled", label: "P1" },
  { key: "rp1Enabled", label: "RP1" },
  { key: "p2Enabled", label: "P2" },
  { key: "rp2Enabled", label: "RP2" },
  { key: "p3Enabled", label: "P3" },
  { key: "rp3Enabled", label: "RP3" },
  { key: "p4Enabled", label: "P4" },
  { key: "rp4Enabled", label: "RP4" },
] as const;

export type SchoolYear = AcademicPeriods & {
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
