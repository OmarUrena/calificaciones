import { toNullableNumber } from "@/lib/academic-grades";
import {
  TECHNICAL_SCORE_FIELDS,
  type SubjectStatus,
  type TechnicalGrade,
  type TechnicalScoreField,
  type TechnicalScoreValues,
} from "@/types/grades";

export const EMPTY_TECHNICAL_SCORES: TechnicalScoreValues = {
  ordinaryScore: null,
  recovery1Score: null,
  recovery2Score: null,
  specialScore: null,
};

export function normalizeTechnicalScores(grade?: TechnicalGrade): TechnicalScoreValues {
  if (!grade) return { ...EMPTY_TECHNICAL_SCORES };

  return Object.fromEntries(
    TECHNICAL_SCORE_FIELDS.map((field) => [field, toNullableNumber(grade[field])]),
  ) as TechnicalScoreValues;
}

export function validateTechnicalScores(
  scores: TechnicalScoreValues,
  weight: number,
  specialAllowed: boolean,
): Partial<Record<TechnicalScoreField, string>> {
  const errors: Partial<Record<TechnicalScoreField, string>> = {};
  const minimum = getTechnicalMinimum(weight);

  for (const field of TECHNICAL_SCORE_FIELDS) {
    const score = scores[field];
    if (score !== null && (score < 0 || score > weight)) {
      errors[field] = `Debe estar entre 0 y ${formatTechnicalScore(weight)}.`;
    }
  }

  if (scores.recovery1Score !== null) {
    if (scores.ordinaryScore === null) {
      errors.recovery1Score = "Requiere la nota ordinaria.";
    } else if (scores.ordinaryScore >= minimum) {
      errors.recovery1Score = "No aplica porque la nota ordinaria alcanzó el mínimo.";
    } else if (scores.recovery1Score < scores.ordinaryScore) {
      errors.recovery1Score = "No puede ser menor que la nota ordinaria.";
    }
  }

  if (scores.recovery2Score !== null) {
    if (scores.recovery1Score === null) {
      errors.recovery2Score = "Requiere la recuperación 1.";
    } else if (scores.recovery1Score >= minimum) {
      errors.recovery2Score = "No aplica porque la recuperación 1 alcanzó el mínimo.";
    } else if (scores.recovery2Score < scores.recovery1Score) {
      errors.recovery2Score = "No puede ser menor que la recuperación 1.";
    }
  }

  if (scores.specialScore !== null) {
    if (scores.recovery2Score === null) {
      errors.specialScore = "Requiere completar la recuperación 2.";
    } else if (scores.recovery2Score >= minimum) {
      errors.specialScore = "No aplica porque el RA ya alcanzó el mínimo.";
    } else if (!specialAllowed) {
      errors.specialScore = "Solo aplica cuando el total del módulo es menor de 70.";
    }
  }

  return errors;
}

export function getTechnicalMinimum(weight: number): number {
  return Math.round(weight * 0.7 * 100) / 100;
}

export function getTechnicalValidScore(scores: TechnicalScoreValues): number | null {
  return (
    scores.specialScore ??
    scores.recovery2Score ??
    scores.recovery1Score ??
    scores.ordinaryScore
  );
}

export function getTechnicalScoreBeforeSpecial(scores: TechnicalScoreValues): number | null {
  return scores.recovery2Score ?? scores.recovery1Score ?? scores.ordinaryScore;
}

export function hasTechnicalScores(scores: TechnicalScoreValues): boolean {
  return TECHNICAL_SCORE_FIELDS.some((field) => scores[field] !== null);
}

export function resolveTechnicalModuleStatus(
  rows: Array<{ scores: TechnicalScoreValues; weight: number }>,
): SubjectStatus {
  const scores = rows.map((row) => row.scores);
  const validScores = scores.map(getTechnicalValidScore);
  if (validScores.some((score) => score === null)) return "PENDING";

  const total = (validScores as number[]).reduce((sum, score) => sum + score, 0);
  if (total >= 70) return "APPROVED";

  const isSpecialReady = rows.every(({ scores: outcomeScores, weight }) => {
    const scoreBeforeSpecial = getTechnicalScoreBeforeSpecial(outcomeScores);
    return (
      scoreBeforeSpecial !== null &&
      (scoreBeforeSpecial >= getTechnicalMinimum(weight) ||
        outcomeScores.recovery2Score !== null)
    );
  });
  if (!isSpecialReady) return "PENDING";

  const hasAllRequiredSpecialScores = rows.every(({ scores: outcomeScores, weight }) => {
    const scoreBeforeSpecial = getTechnicalScoreBeforeSpecial(outcomeScores);
    return (
      scoreBeforeSpecial !== null &&
      (scoreBeforeSpecial >= getTechnicalMinimum(weight) || outcomeScores.specialScore !== null)
    );
  });

  return hasAllRequiredSpecialScores ? "FAILED" : "SPECIAL";
}

export function formatTechnicalScore(value: number | string | null | undefined): string {
  const numericValue = toNullableNumber(value);
  if (numericValue === null) return "—";

  return numericValue.toLocaleString("es-DO", {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
    maximumFractionDigits: 2,
  });
}
