"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type {
  TechnicalLearningOutcome,
  TechnicalLearningOutcomeFormValues,
} from "@/types/technical-learning-outcome";

export function useTechnicalLearningOutcomes(subjectId?: string) {
  return useQuery({
    queryKey: ["technical-learning-outcomes", subjectId],
    queryFn: () =>
      apiFetch<TechnicalLearningOutcome[]>(
        `/technical-learning-outcomes/subject/${subjectId}`,
      ),
    enabled: Boolean(subjectId),
  });
}

export function useCreateTechnicalLearningOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      values: TechnicalLearningOutcomeFormValues & { schoolId: string; subjectId: string },
    ) =>
      apiFetch<TechnicalLearningOutcome>("/technical-learning-outcomes", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: (learningOutcome) => {
      void queryClient.invalidateQueries({
        queryKey: ["technical-learning-outcomes", learningOutcome.subjectId],
      });
    },
  });
}

export function useUpdateTechnicalLearningOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Partial<TechnicalLearningOutcomeFormValues>;
    }) =>
      apiFetch<TechnicalLearningOutcome>(`/technical-learning-outcomes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    onSuccess: (learningOutcome) => {
      void queryClient.invalidateQueries({
        queryKey: ["technical-learning-outcomes", learningOutcome.subjectId],
      });
    },
  });
}

export function useDeactivateTechnicalLearningOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<TechnicalLearningOutcome>(`/technical-learning-outcomes/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (learningOutcome) => {
      void queryClient.invalidateQueries({
        queryKey: ["technical-learning-outcomes", learningOutcome.subjectId],
      });
    },
  });
}
