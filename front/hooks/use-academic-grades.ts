"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type {
  AcademicFinalEvaluationSaveRow,
  AcademicGradeMutationResult,
  AcademicGradeSavePayload,
  AcademicRegister,
  AcademicSubjectResult,
} from "@/types/grades";

export function getAcademicRegisterQueryKey(courseId: string, subjectId: string) {
  return ["academic-register", courseId, subjectId] as const;
}

export function useAcademicRegister(courseId: string, subjectId: string) {
  return useQuery({
    queryKey: getAcademicRegisterQueryKey(courseId, subjectId),
    queryFn: () =>
      apiFetch<AcademicRegister>(
        `/academic-grades/course/${courseId}/subject/${subjectId}/register`,
      ),
    enabled: Boolean(courseId && subjectId),
  });
}

export function useSaveAcademicBlock(courseId: string, subjectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AcademicGradeSavePayload) => {
      const results: AcademicGradeMutationResult[] = [];

      for (const row of payload.rows) {
        if (row.gradeId) {
          results.push(
            await apiFetch<AcademicGradeMutationResult>(`/academic-grades/${row.gradeId}`, {
              method: "PATCH",
              body: JSON.stringify(row.scores),
            }),
          );
          continue;
        }

        results.push(
          await apiFetch<AcademicGradeMutationResult>("/academic-grades", {
            method: "POST",
            body: JSON.stringify({
              schoolId: payload.schoolId,
              schoolYearId: payload.schoolYearId,
              courseId: payload.courseId,
              studentId: row.studentId,
              subjectId: payload.subjectId,
              blockNumber: payload.blockNumber,
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
        queryKey: getAcademicRegisterQueryKey(courseId, subjectId),
      }),
  });
}

export function useSaveAcademicFinalEvaluations(courseId: string, subjectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: AcademicFinalEvaluationSaveRow[]) => {
      const results: AcademicSubjectResult[] = [];

      for (const row of rows) {
        results.push(
          await apiFetch<AcademicSubjectResult>("/academic-grades/final-evaluations", {
            method: "POST",
            body: JSON.stringify({
              studentId: row.studentId,
              subjectId,
              cec: row.cec,
              ceex: row.ceex,
              ce: row.ce,
            }),
          }),
        );
      }

      return results;
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: getAcademicRegisterQueryKey(courseId, subjectId),
      }),
  });
}
