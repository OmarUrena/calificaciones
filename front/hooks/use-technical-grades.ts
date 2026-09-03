"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type {
  TechnicalGradeMutationResult,
  TechnicalGradeSavePayload,
  TechnicalRegister,
} from "@/types/grades";

export function getTechnicalRegisterQueryKey(courseId: string, subjectId: string) {
  return ["technical-register", courseId, subjectId] as const;
}

export function useTechnicalRegister(courseId: string, subjectId: string) {
  return useQuery({
    queryKey: getTechnicalRegisterQueryKey(courseId, subjectId),
    queryFn: () =>
      apiFetch<TechnicalRegister>(
        `/technical-grades/course/${courseId}/subject/${subjectId}/register`,
      ),
    enabled: Boolean(courseId && subjectId),
  });
}

export function useSaveTechnicalLearningOutcome(courseId: string, subjectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TechnicalGradeSavePayload) => {
      const results: TechnicalGradeMutationResult[] = [];

      for (const row of payload.rows) {
        if (row.gradeId) {
          results.push(
            await apiFetch<TechnicalGradeMutationResult>(`/technical-grades/${row.gradeId}`, {
              method: "PATCH",
              body: JSON.stringify(row.scores),
            }),
          );
          continue;
        }

        results.push(
          await apiFetch<TechnicalGradeMutationResult>("/technical-grades", {
            method: "POST",
            body: JSON.stringify({
              schoolId: payload.schoolId,
              schoolYearId: payload.schoolYearId,
              courseId: payload.courseId,
              studentId: row.studentId,
              subjectId: payload.subjectId,
              learningOutcomeId: payload.learningOutcomeId,
              ...Object.fromEntries(
                Object.entries(row.scores).filter(([, value]) => value !== null),
              ),
            }),
          }),
        );
      }

      return results;
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: getTechnicalRegisterQueryKey(courseId, subjectId),
      }),
  });
}
