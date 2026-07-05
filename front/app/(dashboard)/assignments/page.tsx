"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { ClipboardList, Loader2, Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AssignmentForm } from "@/components/forms/AssignmentForm";
import { Button } from "@/components/ui/button";
import type { TeacherAssignment, TeacherAssignmentFormValues } from "@/types/assignment";
import type { Course } from "@/types/course";
import type { SchoolYear } from "@/types/school-year";
import type { Subject } from "@/types/subject";
import type { Teacher } from "@/types/teacher";
import { useCourses } from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSchoolYears } from "@/hooks/use-school-years";
import { useSubjects } from "@/hooks/use-subjects";
import { useTeachers } from "@/hooks/use-teachers";
import {
  useCreateTeacherAssignment,
  useDeactivateTeacherAssignment,
  useTeacherAssignments,
  useUpdateTeacherAssignment,
} from "@/hooks/use-teacher-assignments";
import { ApiError } from "@/lib/api";

const EMPTY_ASSIGNMENTS: TeacherAssignment[] = [];
const EMPTY_COURSES: Course[] = [];
const EMPTY_SCHOOL_YEARS: SchoolYear[] = [];
const EMPTY_SUBJECTS: Subject[] = [];
const EMPTY_TEACHERS: Teacher[] = [];

export default function AssignmentsPage() {
  const searchParams = useSearchParams();
  const selectedTeacherId = searchParams.get("teacherId") ?? "";
  const { data: user } = useCurrentUser();
  const { data: assignments = EMPTY_ASSIGNMENTS, isLoading } = useTeacherAssignments();
  const { data: courses = EMPTY_COURSES } = useCourses();
  const { data: schoolYears = EMPTY_SCHOOL_YEARS } = useSchoolYears();
  const { data: subjects = EMPTY_SUBJECTS } = useSubjects();
  const { data: teachers = EMPTY_TEACHERS } = useTeachers();
  const createAssignment = useCreateTeacherAssignment();
  const updateAssignment = useUpdateTeacherAssignment();
  const deactivateAssignment = useDeactivateTeacherAssignment();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TeacherAssignment | null>(null);

  const canManageAssignments = user?.role === "ADMIN";
  const filteredAssignments = useMemo(
    () =>
      selectedTeacherId
        ? assignments.filter((assignment) => assignment.teacherId === selectedTeacherId)
        : assignments,
    [assignments, selectedTeacherId],
  );

  const openCreateForm = useCallback(() => {
    setEditingAssignment(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((assignment: TeacherAssignment) => {
    setEditingAssignment(assignment);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingAssignment(null);
    setIsFormOpen(false);
  }, []);

  const handleToggleActive = useCallback(
    async (assignment: TeacherAssignment) => {
      const action = assignment.isActive ? "desactivar" : "activar";
      const confirmed = window.confirm(`Deseas ${action} esta asignacion?`);
      if (!confirmed) return;

      try {
        if (assignment.isActive) {
          await deactivateAssignment.mutateAsync(assignment.id);
          toast.success("Asignacion desactivada.");
        } else {
          await updateAssignment.mutateAsync({
            id: assignment.id,
            values: { isActive: true },
          });
          toast.success("Asignacion activada.");
        }
      } catch (error) {
        showError(error);
      }
    },
    [deactivateAssignment, updateAssignment],
  );

  const columns = useMemo<ColumnDef<TeacherAssignment>[]>(
    () => [
      {
        header: "Curso",
        accessorKey: "course",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-institutional-gray-dark">
              {row.original.course?.name ?? "Curso no disponible"}
            </div>
            <div className="text-sm text-institutional-gray">
              {row.original.schoolYear?.name ?? "Sin ano escolar"}
            </div>
          </div>
        ),
      },
      {
        header: "Asignatura",
        accessorKey: "subject",
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-institutional-gray-dark">
              {row.original.subject?.name ?? "Asignatura no disponible"}
            </div>
            {row.original.subject ? <SubjectBadge subject={row.original.subject} /> : null}
          </div>
        ),
      },
      {
        header: "Maestro",
        accessorKey: "teacher",
        cell: ({ row }) => row.original.teacher?.name ?? "Maestro no disponible",
      },
      {
        header: "Estado",
        accessorKey: "isActive",
        cell: ({ row }) => (
          <span
            className={
              row.original.isActive
                ? "status-badge status-approved"
                : "status-badge status-pending"
            }
          >
            {row.original.isActive ? "Activa" : "Inactiva"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => {
          const assignment = row.original;

          return canManageAssignments ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openEditForm(assignment)}>
                <Pencil aria-hidden="true" />
                Editar
              </Button>
              <Button
                disabled={deactivateAssignment.isPending || updateAssignment.isPending}
                size="sm"
                variant="outline"
                onClick={() => handleToggleActive(assignment)}
              >
                {assignment.isActive ? (
                  <ToggleLeft aria-hidden="true" />
                ) : (
                  <ToggleRight aria-hidden="true" />
                )}
                {assignment.isActive ? "Desactivar" : "Activar"}
              </Button>
            </div>
          ) : null;
        },
      },
    ],
    [
      canManageAssignments,
      deactivateAssignment.isPending,
      handleToggleActive,
      openEditForm,
      updateAssignment.isPending,
    ],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredAssignments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleSubmit(values: TeacherAssignmentFormValues) {
    const repeatedAssignment = assignments.find(
      (assignment) =>
        assignment.id !== editingAssignment?.id &&
        assignment.isActive &&
        values.isActive &&
        assignment.schoolYearId === values.schoolYearId &&
        assignment.courseId === values.courseId &&
        assignment.subjectId === values.subjectId,
    );

    if (repeatedAssignment) {
      toast.error("Ese curso ya tiene esa asignatura asignada en el ano escolar seleccionado.");
      return;
    }

    try {
      if (editingAssignment) {
        await updateAssignment.mutateAsync({ id: editingAssignment.id, values });
        toast.success("Asignacion actualizada.");
      } else {
        const schoolId = user?.school?.id ?? user?.schoolId;
        if (!schoolId) {
          toast.error("El usuario no tiene una escuela asignada.");
          return;
        }

        await createAssignment.mutateAsync({ ...values, schoolId });
        toast.success("Asignacion creada.");
      }
      closeForm();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="institutional-title">Asignaciones docentes</h1>
          <p className="institutional-subtitle">
            Define que maestro imparte cada asignatura por curso y ano escolar.
          </p>
        </div>
        {canManageAssignments ? (
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Crear asignacion
          </Button>
        ) : null}
      </div>

      {!canManageAssignments ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray">
            Solo usuarios administrativos pueden gestionar asignaciones docentes.
          </p>
        </div>
      ) : null}

      {selectedTeacherId ? (
        <div className="admin-card">
          <p className="text-base text-institutional-gray-dark">
            Mostrando asignaciones del maestro seleccionado.
          </p>
        </div>
      ) : null}

      {isFormOpen ? (
        <AssignmentForm
          assignment={editingAssignment}
          courses={courses}
          schoolYears={schoolYears}
          subjects={subjects}
          teachers={teachers}
          selectedTeacherId={selectedTeacherId}
          isSubmitting={createAssignment.isPending || updateAssignment.isPending}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      <div className="admin-card overflow-hidden p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-base text-institutional-gray">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando asignaciones...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-institutional-gray" aria-hidden="true" />
            <p className="text-lg font-medium text-institutional-gray-dark">
              No hay asignaciones registradas
            </p>
            <p className="text-base text-institutional-gray">
              Crea la primera asignacion docente para habilitar permisos de maestros.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="compact-table">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        className={header.column.id === "actions" ? "w-72" : undefined}
                        key={header.id}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SubjectBadge({ subject }: { subject: Subject }) {
  return (
    <span
      className={
        subject.type === "TECHNICAL"
          ? "status-badge status-approved mt-1"
          : "status-badge status-pending mt-1"
      }
    >
      {subject.type === "TECHNICAL" ? "Tecnica" : "Academica"}
    </span>
  );
}

function showError(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "No se pudo completar la accion.");
}
