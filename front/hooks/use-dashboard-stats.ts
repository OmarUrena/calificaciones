"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "@/types/auth";

type RecordItem = Record<string, unknown>;

export type DashboardStats = {
  activeSchoolYear: string;
  courses: number | null;
  students: number | null;
  teachers: number | null;
  subjects: number | null;
  coursesWithoutTitular: number | null;
  incompleteGrades: number | null;
  assignments: number | null;
  teacherCourses: number | null;
  titularCourses: number | null;
  schools: number | null;
};

export function useDashboardStats(user?: CurrentUser | null) {
  return useQuery({
    queryKey: ["dashboard-stats", user?.role, user?.id],
    queryFn: () => getDashboardStats(user),
    enabled: Boolean(user),
    retry: false,
  });
}

async function getDashboardStats(user?: CurrentUser | null): Promise<DashboardStats> {
  const baseStats: DashboardStats = {
    activeSchoolYear: user?.activeSchoolYear?.name ?? "No definido",
    courses: null,
    students: null,
    teachers: null,
    subjects: null,
    coursesWithoutTitular: null,
    incompleteGrades: null,
    assignments: null,
    teacherCourses: null,
    titularCourses: null,
    schools: null,
  };

  if (!user) return baseStats;

  if (user.role === "SUPER_ADMIN") {
    const schools = await getListSafely("/schools");
    return {
      ...baseStats,
      schools: schools?.length ?? null,
    };
  }

  if (user.role === "TEACHER") {
    const assignments = await getListSafely("/teacher-assignments");
    const teacherCourses = new Set(
      assignments?.map((assignment) => getId(assignment.courseId ?? getNestedId(assignment, "course"))),
    );
    const titularCourses = new Set(
      assignments
        ?.filter((assignment) => getNestedId(assignment, "course.titular") === user.teacherId)
        .map((assignment) => getId(assignment.courseId ?? getNestedId(assignment, "course"))),
    );

    return {
      ...baseStats,
      assignments: assignments?.length ?? null,
      teacherCourses: countDefinedSet(teacherCourses),
      titularCourses: countDefinedSet(titularCourses),
    };
  }

  const [courses, students, teachers, subjects, assignments] = await Promise.all([
    getListSafely("/courses"),
    getListSafely("/students"),
    getListSafely("/teachers"),
    getListSafely("/subjects"),
    getListSafely("/teacher-assignments"),
  ]);

  return {
    ...baseStats,
    courses: courses?.length ?? null,
    students: students?.length ?? null,
    teachers: teachers?.length ?? null,
    subjects: subjects?.length ?? null,
    coursesWithoutTitular: courses?.filter((course) => !course.titularId && !course.titular).length ?? null,
    assignments: assignments?.length ?? null,
    incompleteGrades: null,
  };
}

async function getListSafely(path: string) {
  try {
    const response = await apiFetch<unknown>(path);
    return Array.isArray(response) ? (response as RecordItem[]) : null;
  } catch {
    return null;
  }
}

function getNestedId(item: RecordItem, path: string) {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as RecordItem)[key];
    }
    return undefined;
  }, item);

  return getId(value);
}

function getId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

function countDefinedSet(items: Set<string | undefined>) {
  items.delete(undefined);
  return items.size;
}
