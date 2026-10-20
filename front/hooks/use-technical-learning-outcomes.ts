"use client";

import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type {
  TechnicalLearningOutcome,
  TechnicalLearningOutcomeFormValues,
} from "@/types/technical-learning-outcome";

function cacheOutcome(
  queryClient: QueryClient,
  outcome: TechnicalLearningOutcome,
) {
  queryClient.setQueryData<TechnicalLearningOutcome[]>(
    ["technical-learning-outcomes", outcome.subjectId],
    (current = []) =>
      [...current.filter((item) => item.id !== outcome.id), outcome].sort(
        (left, right) => left.order - right.order,
      ),
  );
}

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
      values: TechnicalLearningOutcomeFormValues & {
        schoolId: string;
        subjectId: string;
      },
    ) =>
      apiFetch<TechnicalLearningOutcome>("/technical-learning-outcomes", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: async (learningOutcome) => {
      await queryClient.cancelQueries({
        queryKey: ["technical-learning-outcomes", learningOutcome.subjectId],
      });
      cacheOutcome(queryClient, learningOutcome);
      await queryClient.invalidateQueries({
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
    onSuccess: async (learningOutcome) => {
      await queryClient.cancelQueries({
        queryKey: ["technical-learning-outcomes", learningOutcome.subjectId],
      });
      cacheOutcome(queryClient, learningOutcome);
      await queryClient.invalidateQueries({
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
    onSuccess: async (learningOutcome) => {
      await queryClient.cancelQueries({
        queryKey: ["technical-learning-outcomes", learningOutcome.subjectId],
      });
      cacheOutcome(queryClient, learningOutcome);
      await queryClient.invalidateQueries({
        queryKey: ["technical-learning-outcomes", learningOutcome.subjectId],
      });
    },
  });
}

export function useSaveTechnicalLearningOutcomeConfiguration(
  subjectId: string,
) {
  const queryClient = useQueryClient();
  const queryKey = ["technical-learning-outcomes", subjectId];

  return useMutation({
    mutationFn: (
      configuration:
        | {
            newOutcomes: (TechnicalLearningOutcomeFormValues & {
              schoolId: string;
              subjectId: string;
            })[];
          }
        | { weights: { id: string; weight: number }[] },
    ) => {
      if ("newOutcomes" in configuration) {
        return apiFetch<TechnicalLearningOutcome[]>(
          "/technical-learning-outcomes/batch",
          {
            method: "POST",
            body: JSON.stringify({ items: configuration.newOutcomes }),
          },
        );
      }
      return apiFetch<TechnicalLearningOutcome[]>(
        `/technical-learning-outcomes/subject/${subjectId}/weights`,
        {
          method: "PATCH",
          body: JSON.stringify({ items: configuration.weights }),
        },
      );
    },
    onSuccess: async (outcomes) => {
      await queryClient.cancelQueries({ queryKey });
      for (const outcome of outcomes) cacheOutcome(queryClient, outcome);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["technical-register"] });
    },
  });
}
