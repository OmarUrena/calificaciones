"use client";

import type { TechnicalLearningOutcome } from "@/types/technical-learning-outcome";

type TechnicalOutcomeWeightProps = {
  outcome: TechnicalLearningOutcome;
  value: string;
  disabled: boolean;
  onChange: (id: string, weight: string) => void;
};

export function TechnicalOutcomeWeight({
  outcome,
  value,
  disabled,
  onChange,
}: TechnicalOutcomeWeightProps) {
  return (
    <div className="min-w-32 space-y-2">
      <input
        className="form-control max-w-32"
        aria-label={`Peso de ${outcome.code}`}
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(outcome.id, event.target.value);
        }}
      />
    </div>
  );
}
