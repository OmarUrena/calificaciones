"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useSaveTechnicalLearningOutcome } from "@/hooks/use-technical-grades";
import { ApiError } from "@/lib/api";
import {
  getTechnicalMinimum,
  getTechnicalScoreBeforeSpecial,
  hasTechnicalScores,
  normalizeTechnicalScores,
  validateTechnicalScores,
} from "@/lib/technical-grades";
import type {
  TechnicalGrade,
  TechnicalRegister,
  TechnicalScoreField,
  TechnicalScoreValues,
  TechnicalSubjectResult,
} from "@/types/grades";

import { TechnicalGradeTable } from "./TechnicalGradeTable";
import { TechnicalRaTabs, type TechnicalTab } from "./TechnicalRaTabs";
import { TechnicalSummaryTable } from "./TechnicalSummaryTable";

type TechnicalDrafts = Record<string, TechnicalScoreValues>;

export function TechnicalGradeEditor({ register }: { register: TechnicalRegister }) {
  const [activeTab, setActiveTab] = useState<TechnicalTab>(
    () => register.learningOutcomes[0]?.id ?? "summary",
  );
  const [drafts, setDrafts] = useState<TechnicalDrafts>(() => createTechnicalDrafts(register));
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(() => new Set());
  const saveLearningOutcome = useSaveTechnicalLearningOutcome(
    register.course.id,
    register.subject.id,
  );

  const gradesByKey = useMemo(
    () =>
      Object.fromEntries(
        register.grades.map((grade) => [
          getTechnicalDraftKey(grade.learningOutcomeId, grade.studentId),
          grade,
        ]),
      ) as Record<string, TechnicalGrade | undefined>,
    [register.grades],
  );
  const resultsByStudent = useMemo(
    () =>
      Object.fromEntries(register.results.map((result) => [result.studentId, result])) as Record<
        string,
        TechnicalSubjectResult | undefined
      >,
    [register.results],
  );
  const activeOutcome = useMemo(
    () => register.learningOutcomes.find((outcome) => outcome.id === activeTab),
    [activeTab, register.learningOutcomes],
  );
  const activeScoresByStudent = useMemo(() => {
    if (!activeOutcome) return {};

    return Object.fromEntries(
      register.students.map((student) => [
        student.id,
        drafts[getTechnicalDraftKey(activeOutcome.id, student.id)],
      ]),
    );
  }, [activeOutcome, drafts, register.students]);
  const activeDirtyStudentIds = useMemo(() => {
    if (!activeOutcome) return new Set<string>();

    return new Set(
      register.students
        .filter((student) =>
          dirtyRows.has(getTechnicalDraftKey(activeOutcome.id, student.id)),
        )
        .map((student) => student.id),
    );
  }, [activeOutcome, dirtyRows, register.students]);
  const allDirtyStudentIds = useMemo(
    () =>
      new Set(
        register.students
          .filter((student) =>
            register.learningOutcomes.some((outcome) =>
              dirtyRows.has(getTechnicalDraftKey(outcome.id, student.id)),
            ),
          )
          .map((student) => student.id),
      ),
    [dirtyRows, register.learningOutcomes, register.students],
  );
  const specialAllowedByStudent = useMemo(
    () =>
      Object.fromEntries(
        register.students.map((student) => {
          const outcomeStates = register.learningOutcomes.map((outcome) => {
            const scores = drafts[getTechnicalDraftKey(outcome.id, student.id)];
            return {
              scores,
              scoreBeforeSpecial: getTechnicalScoreBeforeSpecial(scores),
              minimum: getTechnicalMinimum(Number(outcome.weight)),
            };
          });
          const hasCompletedRecoveryPath = outcomeStates.every(
            ({ scores, scoreBeforeSpecial, minimum }) =>
              scoreBeforeSpecial !== null &&
              (scoreBeforeSpecial >= minimum || scores.recovery2Score !== null),
          );
          const totalBeforeSpecial = outcomeStates.reduce<number>(
            (sum, outcome) => sum + (outcome.scoreBeforeSpecial ?? 0),
            0,
          );

          return [student.id, hasCompletedRecoveryPath && totalBeforeSpecial < 70];
        }),
      ) as Record<string, boolean>,
    [drafts, register.learningOutcomes, register.students],
  );

  const dirtyCount = activeOutcome ? activeDirtyStudentIds.size : 0;

  function getScores(studentId: string, learningOutcomeId: string) {
    return drafts[getTechnicalDraftKey(learningOutcomeId, studentId)];
  }

  function handleScoreChange(
    studentId: string,
    field: TechnicalScoreField,
    value: number | null,
  ) {
    if (!activeOutcome) return;

    const draftKey = getTechnicalDraftKey(activeOutcome.id, studentId);
    const minimum = getTechnicalMinimum(Number(activeOutcome.weight));

    setDrafts((current) => {
      const scores = { ...current[draftKey], [field]: value };

      if (field === "ordinaryScore" && (value === null || value >= minimum)) {
        scores.recovery1Score = null;
        scores.recovery2Score = null;
        scores.specialScore = null;
      }
      if (field === "recovery1Score" && (value === null || value >= minimum)) {
        scores.recovery2Score = null;
        scores.specialScore = null;
      }
      if (field === "recovery2Score" && (value === null || value >= minimum)) {
        scores.specialScore = null;
      }

      return { ...current, [draftKey]: scores };
    });
    setDirtyRows((current) => new Set(current).add(draftKey));
  }

  function handleTabChange(tab: TechnicalTab) {
    if (tab !== activeTab && dirtyRows.size > 0) {
      toast.info("Guarda los cambios del RA actual antes de cambiar de pestaña.");
      return;
    }

    setActiveTab(tab);
  }

  async function handleSave() {
    if (!activeOutcome) {
      toast.info("Selecciona un RA para guardar calificaciones.");
      return;
    }

    const changedStudents = register.students.filter((student) =>
      dirtyRows.has(getTechnicalDraftKey(activeOutcome.id, student.id)),
    );

    if (changedStudents.length === 0) {
      toast.info("No hay cambios pendientes en este RA.");
      return;
    }

    const weight = Number(activeOutcome.weight);
    const invalidStudent = changedStudents.find((student) => {
      const scores = getScores(student.id, activeOutcome.id);
      return (
        Object.keys(
          validateTechnicalScores(scores, weight, specialAllowedByStudent[student.id]),
        ).length > 0
      );
    });

    if (invalidStudent) {
      toast.error(
        `Revisa las calificaciones de ${invalidStudent.firstName} ${invalidStudent.lastName}.`,
      );
      return;
    }

    const rows = changedStudents
      .map((student) => {
        const draftKey = getTechnicalDraftKey(activeOutcome.id, student.id);
        const grade = gradesByKey[draftKey];
        const scores = drafts[draftKey];

        if (!grade && !hasTechnicalScores(scores)) return null;
        return { gradeId: grade?.id, studentId: student.id, scores };
      })
      .filter((row) => row !== null);

    if (rows.length === 0) {
      setDirtyRows((current) => {
        const next = new Set(current);
        changedStudents.forEach((student) =>
          next.delete(getTechnicalDraftKey(activeOutcome.id, student.id)),
        );
        return next;
      });
      toast.info("No hay calificaciones para guardar.");
      return;
    }

    try {
      await saveLearningOutcome.mutateAsync({
        schoolId: register.course.schoolId,
        schoolYearId: register.course.schoolYearId,
        courseId: register.course.id,
        subjectId: register.subject.id,
        learningOutcomeId: activeOutcome.id,
        rows,
      });
      toast.success(`${activeOutcome.code} guardado correctamente.`);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "No se pudieron guardar las calificaciones técnicas.",
      );
    }
  }

  return (
    <div className="admin-card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
        <div>
          <p className="font-semibold text-institutional-gray-dark">
            {activeOutcome
              ? `Registro de ${activeOutcome.code} · ${activeOutcome.name}`
              : "Resumen del módulo técnico"}
          </p>
          <p className="text-sm text-institutional-gray">
            {activeOutcome
              ? dirtyCount > 0
                ? `${dirtyCount} ${dirtyCount === 1 ? "fila modificada" : "filas modificadas"}`
                : "Todos los cambios están guardados"
              : allDirtyStudentIds.size > 0
                ? "Hay cambios sin guardar en uno o más RA."
                : "Total y estado calculados con las notas válidas."}
          </p>
        </div>
        <button
          className="btn-primary-institutional inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!activeOutcome || saveLearningOutcome.isPending || dirtyCount === 0}
          onClick={() => void handleSave()}
          type="button"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveLearningOutcome.isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      <TechnicalRaTabs
        activeTab={activeTab}
        learningOutcomes={register.learningOutcomes}
        onChange={handleTabChange}
      />

      <div role="tabpanel">
        {activeOutcome ? (
          <TechnicalGradeTable
            dirtyStudentIds={activeDirtyStudentIds}
            onScoreChange={handleScoreChange}
            scoresByStudent={activeScoresByStudent}
            specialAllowedByStudent={specialAllowedByStudent}
            students={register.students}
            weight={Number(activeOutcome.weight)}
          />
        ) : (
          <TechnicalSummaryTable
            dirtyStudentIds={allDirtyStudentIds}
            getScores={getScores}
            learningOutcomes={register.learningOutcomes}
            resultsByStudent={resultsByStudent}
            students={register.students}
          />
        )}
      </div>
    </div>
  );
}

function createTechnicalDrafts(register: TechnicalRegister): TechnicalDrafts {
  const gradesByKey = new Map(
    register.grades.map((grade) => [
      getTechnicalDraftKey(grade.learningOutcomeId, grade.studentId),
      grade,
    ]),
  );
  const drafts: TechnicalDrafts = {};

  for (const student of register.students) {
    for (const outcome of register.learningOutcomes) {
      const key = getTechnicalDraftKey(outcome.id, student.id);
      drafts[key] = normalizeTechnicalScores(gradesByKey.get(key));
    }
  }

  return drafts;
}

function getTechnicalDraftKey(learningOutcomeId: string, studentId: string) {
  return `${learningOutcomeId}:${studentId}`;
}
