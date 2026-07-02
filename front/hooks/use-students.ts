"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { Student, StudentFormValues } from "@/types/student";

const STUDENTS_QUERY_KEY = ["students"];

export function useStudents() {
  return useQuery({
    queryKey: STUDENTS_QUERY_KEY,
    queryFn: () => apiFetch<Student[]>("/students"),
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      values: StudentFormValues & {
        schoolId: string;
        schoolYearId: string;
      },
    ) =>
      apiFetch<Student>("/students", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Partial<StudentFormValues> & { schoolYearId?: string };
    }) =>
      apiFetch<Student>(`/students/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiFetch<Student>(`/students/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
