import {
  ACADEMIC_SCORE_FIELDS,
  type AcademicGrade,
  type AcademicFinalEvaluationValues,
  type AcademicRecoveryField,
  type AcademicScoreField,
  type AcademicScoreValues,
  type ApiNumericValue,
} from "@/types/grades";

export const EMPTY_ACADEMIC_SCORES: AcademicScoreValues = {
  p1: null,
  rp1: null,
  p2: null,
  rp2: null,
  p3: null,
  rp3: null,
  p4: null,
  rp4: null,
};

export const RECOVERY_BY_ORDINARY = {
  p1: "rp1",
  p2: "rp2",
  p3: "rp3",
  p4: "rp4",
} as const;

export const ORDINARY_BY_RECOVERY: Record<AcademicRecoveryField, keyof typeof RECOVERY_BY_ORDINARY> = {
  rp1: "p1",
  rp2: "p2",
  rp3: "p3",
  rp4: "p4",
};

export function normalizeAcademicScores(grade?: AcademicGrade): AcademicScoreValues {
  if (!grade) return { ...EMPTY_ACADEMIC_SCORES };

  return Object.fromEntries(
    ACADEMIC_SCORE_FIELDS.map((field) => [field, toNullableNumber(grade[field])]),
  ) as AcademicScoreValues;
}

export function toNullableNumber(value: ApiNumericValue | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function parseGradeInput(value: string): number | null {
  if (value.trim() === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function validateAcademicScores(scores: AcademicScoreValues): Partial<Record<AcademicScoreField, string>> {
  const errors: Partial<Record<AcademicScoreField, string>> = {};

  for (const field of ACADEMIC_SCORE_FIELDS) {
    const score = scores[field];
    if (score !== null && (score < 0 || score > 100)) {
      errors[field] = "Debe estar entre 0 y 100.";
    }
  }

  for (const recovery of Object.keys(ORDINARY_BY_RECOVERY) as AcademicRecoveryField[]) {
    const ordinary = ORDINARY_BY_RECOVERY[recovery];
    const ordinaryScore = scores[ordinary];
    const recoveryScore = scores[recovery];

    if (recoveryScore === null) continue;
    if (ordinaryScore === null) {
      errors[recovery] = "Requiere la nota ordinaria.";
    } else if (ordinaryScore >= 70) {
      errors[recovery] = "Solo aplica cuando la nota ordinaria es menor de 70.";
    } else if (recoveryScore < ordinaryScore) {
      errors[recovery] = "No puede ser menor que la nota ordinaria.";
    }
  }

  return errors;
}

export function calculateAcademicPc(scores: AcademicScoreValues): number | null {
  const validScores = (["p1", "p2", "p3", "p4"] as const).map((ordinary) => {
    const recovery = RECOVERY_BY_ORDINARY[ordinary];
    return scores[recovery] ?? scores[ordinary];
  });

  if (validScores.some((score) => score === null)) return null;

  const average = (validScores as number[]).reduce((sum, score) => sum + score, 0) / 4;
  return Math.round(average * 10) / 10;
}

export function hasAcademicScores(scores: AcademicScoreValues): boolean {
  return ACADEMIC_SCORE_FIELDS.some((field) => scores[field] !== null);
}

export function formatDecimalScore(value: ApiNumericValue | undefined): string {
  const numericValue = toNullableNumber(value);
  return numericValue === null ? "—" : numericValue.toFixed(1);
}

export function formatIntegerScore(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

export function validateFinalEvaluations(
  values: AcademicFinalEvaluationValues,
  cf: number | null | undefined,
): Partial<Record<keyof AcademicFinalEvaluationValues, string>> {
  const errors: Partial<Record<keyof AcademicFinalEvaluationValues, string>> = {};

  for (const field of ["cec", "ceex", "ce"] as const) {
    const score = values[field];
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) {
      errors[field] = "Debe ser un entero entre 0 y 100.";
    }
  }

  if (cf !== null && cf !== undefined && values.ce !== null && cf + values.ce > 100) {
    errors.ce = "CF + CE no puede superar 100.";
  }

  return errors;
}
