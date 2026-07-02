"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { Course, CourseFormValues } from "@/types/course";

const COURSES_QUERY_KEY = ["courses"];

export function useCourses() {
  return useQuery({
    queryKey: COURSES_QUERY_KEY,
    queryFn: () => apiFetch<Course[]>("/courses"),
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CourseFormValues & { schoolId: string }) =>
      apiFetch<Course>("/courses", {
        method: "POST",
        body: JSON.stringify(cleanCoursePayload(values)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<CourseFormValues> }) =>
      apiFetch<Course>(`/courses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(cleanCoursePayload(values)),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiFetch<Course>(`/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

function cleanCoursePayload(values: Partial<CourseFormValues & { schoolId: string }>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? undefined : value,
    ]),
  );
}
