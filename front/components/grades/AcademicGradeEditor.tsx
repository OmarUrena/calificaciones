"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  hasAcademicScores,
  normalizeAcademicScores,
  RECOVERY_BY_ORDINARY,
  toNullableNumber,
  validateAcademicScores,
  validateFinalEvaluations,
} from "@/lib/academic-grades";
import { ApiError } from "@/lib/api";
import {
  useSaveAcademicBlock,
  useSaveAcademicFinalEvaluations,
} from "@/hooks/use-academic-grades";
import type {
  AcademicFinalEvaluationValues,
  AcademicGrade,
  AcademicRegister,
  AcademicScoreField,
  AcademicScoreValues,
  AcademicSubjectResult,
} from "@/types/grades";

import { AcademicBlockTabs, type AcademicTab } from "./AcademicBlockTabs";
import { AcademicGradeTable } from "./AcademicGradeTable";
import { AcademicSummaryTable } from "./AcademicSummaryTable";

type AcademicDrafts = Record<string, AcademicScoreValues>;
type FinalEvaluationDrafts = Record<string, AcademicFinalEvaluationValues>;

export function AcademicGradeEditor({ register }: { register: AcademicRegister }) {
  const [activeTab, setActiveTab] = useState<AcademicTab>(1);
  const [academicDrafts, setAcademicDrafts] = useState<AcademicDrafts>(() =>
    createAcademicDrafts(register),
  );
  const [finalDrafts, setFinalDrafts] = useState<FinalEvaluationDrafts>(() =>
    createFinalDrafts(register),
  );
  const [dirtyAcademicRows, setDirtyAcademicRows] = useState<Set<string>>(() => new Set());
  const [dirtyFinalRows, setDirtyFinalRows] = useState<Set<string>>(() => new Set());
  const saveBlock = useSaveAcademicBlock(register.course.id, register.subject.id);
  const saveFinalEvaluations = useSaveAcademicFinalEvaluations(
    register.course.id,
    register.subject.id,
  );

  const gradesByKey = useMemo(
    () =>
      Object.fromEntries(
        register.grades.map((grade) => [getAcademicDraftKey(grade.blockNumber, grade.studentId), grade]),
      ) as Record<string, AcademicGrade | undefined>,
    [register.grades],
  );
  const resultsByStudent = useMemo(
    () =>
      Object.fromEntries(register.results.map((result) => [result.studentId, result])) as Record<
        string,
        AcademicSubjectResult | undefined
      >,
    [register.results],
  );
  const activeScoresByStudent = useMemo(() => {
    if (activeTab === "summary") return {};

    return Object.fromEntries(
      register.students.map((student) => [
        student.id,
        academicDrafts[getAcademicDraftKey(activeTab, student.id)],
      ]),
    );
  }, [academicDrafts, activeTab, register.students]);
  const activeDirtyStudentIds = useMemo(() => {
    if (activeTab === "summary") return dirtyFinalRows;

    return new Set(
      register.students
        .filter((student) => dirtyAcademicRows.has(getAcademicDraftKey(activeTab, student.id)))
        .map((student) => student.id),
    );
  }, [activeTab, dirtyAcademicRows, dirtyFinalRows, register.students]);

  const isSaving = saveBlock.isPending || saveFinalEvaluations.isPending;
  const dirtyCount = activeDirtyStudentIds.size;

  function handleScoreChange(
    studentId: string,
    field: AcademicScoreField,
    value: number | null,
  ) {
    if (activeTab === "summary") return;

    const draftKey = getAcademicDraftKey(activeTab, studentId);
    setAcademicDrafts((current) => {
      const scores = { ...current[draftKey], [field]: value };

      if (isOrdinaryField(field) && (value === null || value >= 70)) {
        scores[RECOVERY_BY_ORDINARY[field]] = null;
      }

      return { ...current, [draftKey]: scores };
    });
    setDirtyAcademicRows((current) => new Set(current).add(draftKey));
  }

  function handleFinalEvaluationChange(
    studentId: string,
    field: keyof AcademicFinalEvaluationValues,
    value: number | null,
  ) {
    setFinalDrafts((current) => ({
      ...current,
      [studentId]: { ...current[studentId], [field]: value },
    }));
    setDirtyFinalRows((current) => new Set(current).add(studentId));
  }

  async function handleSave() {
    if (activeTab === "summary") {
      await saveSummary();
      return;
    }

    await saveActiveBlock(activeTab);
  }

  async function saveActiveBlock(blockNumber: number) {
    const changedStudents = register.students.filter((student) =>
      dirtyAcademicRows.has(getAcademicDraftKey(blockNumber, student.id)),
    );

    if (changedStudents.length === 0) {
      toast.info("No hay cambios pendientes en este bloque.");
      return;
    }

    const invalidStudent = changedStudents.find((student) => {
      const scores = academicDrafts[getAcademicDraftKey(blockNumber, student.id)];
      return Object.keys(validateAcademicScores(scores)).length > 0;
    });

    if (invalidStudent) {
      toast.error(
        `Revisa las calificaciones de ${invalidStudent.firstName} ${invalidStudent.lastName}.`,
      );
      return;
    }

    const rows = changedStudents
      .map((student) => {
        const draftKey = getAcademicDraftKey(blockNumber, student.id);
        const grade = gradesByKey[draftKey];
        const scores = academicDrafts[draftKey];

        if (!grade && !hasAcademicScores(scores)) return null;
        return { gradeId: grade?.id, studentId: student.id, scores };
      })
      .filter((row) => row !== null);

    if (rows.length === 0) {
      setDirtyAcademicRows((current) => {
        const next = new Set(current);
        changedStudents.forEach((student) =>
          next.delete(getAcademicDraftKey(blockNumber, student.id)),
        );
        return next;
      });
      toast.info("No hay calificaciones para guardar.");
      return;
    }

    try {
      await saveBlock.mutateAsync({
        schoolId: register.course.schoolId,
        schoolYearId: register.course.schoolYearId,
        courseId: register.course.id,
        subjectId: register.subject.id,
        blockNumber,
        rows,
      });
      toast.success(`Bloque ${blockNumber} guardado correctamente.`);
    } catch (error) {
      showError(error, "No se pudo guardar el bloque académico.");
    }
  }

  async function saveSummary() {
    const changedStudents = register.students.filter((student) => dirtyFinalRows.has(student.id));

    if (changedStudents.length === 0) {
      toast.info("No hay evaluaciones finales pendientes.");
      return;
    }

    const invalidStudent = changedStudents.find((student) => {
      const result = resultsByStudent[student.id];
      return Object.keys(validateFinalEvaluations(finalDrafts[student.id], result?.cf)).length > 0;
    });

    if (invalidStudent) {
      toast.error(
        `Revisa las evaluaciones finales de ${invalidStudent.firstName} ${invalidStudent.lastName}.`,
      );
      return;
    }

    try {
      await saveFinalEvaluations.mutateAsync(
        changedStudents.map((student) => ({
          studentId: student.id,
          ...finalDrafts[student.id],
        })),
      );
      toast.success("Evaluaciones finales guardadas correctamente.");
    } catch (error) {
      showError(error, "No se pudieron guardar las evaluaciones finales.");
    }
  }

  return (
    <div className="admin-card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
        <div>
          <p className="font-semibold text-institutional-gray-dark">
            {activeTab === "summary" ? "Resumen académico" : `Registro del bloque ${activeTab}`}
          </p>
          <p className="text-sm text-institutional-gray">
            {dirtyCount > 0
              ? `${dirtyCount} ${dirtyCount === 1 ? "fila modificada" : "filas modificadas"}`
              : "Todos los cambios están guardados"}
          </p>
        </div>
        <button
          className="btn-primary-institutional inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving || dirtyCount === 0}
          onClick={() => void handleSave()}
          type="button"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      <AcademicBlockTabs activeTab={activeTab} onChange={setActiveTab} />

      <div role="tabpanel">
        {activeTab === "summary" ? (
          <AcademicSummaryTable
            dirtyStudentIds={dirtyFinalRows}
            evaluationsByStudent={finalDrafts}
            onEvaluationChange={handleFinalEvaluationChange}
            resultsByStudent={resultsByStudent}
            students={register.students}
          />
        ) : (
          <AcademicGradeTable
            dirtyStudentIds={activeDirtyStudentIds}
            onScoreChange={handleScoreChange}
            scoresByStudent={activeScoresByStudent}
            students={register.students}
          />
        )}
      </div>
    </div>
  );
}

function createAcademicDrafts(register: AcademicRegister): AcademicDrafts {
  const gradesByKey = new Map(
    register.grades.map((grade) => [getAcademicDraftKey(grade.blockNumber, grade.studentId), grade]),
  );
  const drafts: AcademicDrafts = {};

  for (const student of register.students) {
    for (let blockNumber = 1; blockNumber <= 4; blockNumber += 1) {
      const key = getAcademicDraftKey(blockNumber, student.id);
      drafts[key] = normalizeAcademicScores(gradesByKey.get(key));
    }
  }

  return drafts;
}

function createFinalDrafts(register: AcademicRegister): FinalEvaluationDrafts {
  const resultsByStudent = new Map(register.results.map((result) => [result.studentId, result]));

  return Object.fromEntries(
    register.students.map((student) => {
      const result = resultsByStudent.get(student.id);
      return [
        student.id,
        {
          cec: toNullableNumber(result?.cec),
          ceex: toNullableNumber(result?.ceex),
          ce: toNullableNumber(result?.ce),
        },
      ];
    }),
  );
}

function getAcademicDraftKey(blockNumber: number, studentId: string) {
  return `${blockNumber}:${studentId}`;
}

function isOrdinaryField(field: AcademicScoreField): field is keyof typeof RECOVERY_BY_ORDINARY {
  return field === "p1" || field === "p2" || field === "p3" || field === "p4";
}

function showError(error: unknown, fallback: string) {
  toast.error(error instanceof ApiError ? error.message : fallback);
}
