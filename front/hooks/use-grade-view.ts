"use client";

import { useQuery } from "@tanstack/react-query";

import { useCurrentUser } from "@/hooks/use-current-user";
import { apiFetch } from "@/lib/api";
import type { Course } from "@/types/course";
import type { AcademicRegister, TechnicalRegister } from "@/types/grades";
import type { Subject } from "@/types/subject";

export type GradeViewRegister =
  | (AcademicRegister & { type: "ACADEMIC" })
  | (TechnicalRegister & { type: "TECHNICAL" });

export type GradeViewCourse = Course & { school: { id: string; name: string } };

export function useGradeViewCourses() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["grade-view", user?.id, "courses"],
    queryFn: () => apiFetch<GradeViewCourse[]>("/grade-view/courses"),
    enabled: Boolean(user),
  });
}

export function useGradeViewSubjects(courseId: string) {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["grade-view", user?.id, "subjects", courseId],
    queryFn: () => apiFetch<Subject[]>(`/grade-view/course/${courseId}/subjects`),
    enabled: Boolean(user && courseId),
  });
}

export function useGradeViewRegister(courseId: string, subjectId: string) {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["grade-view", user?.id, "register", courseId, subjectId],
    queryFn: () => apiFetch<GradeViewRegister>(`/grade-view/course/${courseId}/subject/${subjectId}`),
    enabled: Boolean(user && courseId && subjectId),
  });
}
