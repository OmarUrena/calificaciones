"use client";

import { FileDown, FileText, Loader2, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCourses } from "@/hooks/use-courses";
import { useCurrentUser } from "@/hooks/use-current-user";
import { downloadCourseReports, downloadStudentReport } from "@/hooks/use-reports";
import { useSchoolYears } from "@/hooks/use-school-years";
import { useStudents } from "@/hooks/use-students";
import { ApiError } from "@/lib/api";

type DownloadType = "student" | "course" | null;

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsPageContent />
    </Suspense>
  );
}

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const { data: user } = useCurrentUser();
  const { data: schoolYears = [], isLoading: loadingSchoolYears } = useSchoolYears();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const { data: students = [], isLoading: loadingStudents } = useStudents();
  const requestedCourseId = searchParams.get("courseId") ?? "";
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState(() => requestedCourseId);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [period, setPeriod] = useState(1);
  const [downloading, setDownloading] = useState<DownloadType>(null);

  const requestedCourse = courses.find((course) => course.id === requestedCourseId);
  const effectiveSchoolYearId =
    selectedSchoolYearId ?? requestedCourse?.schoolYearId ?? user?.activeSchoolYear?.id ?? "";
  const visibleCourses = useMemo(
    () =>
      effectiveSchoolYearId
        ? courses.filter((course) => course.schoolYearId === effectiveSchoolYearId)
        : courses,
    [courses, effectiveSchoolYearId],
  );
  const courseStudents = useMemo(
    () =>
      students
        .filter((student) => student.courseId === selectedCourseId)
        .sort((a, b) => a.listNumber - b.listNumber),
    [selectedCourseId, students],
  );
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const canGenerate =
    user?.role !== "TEACHER" ||
    Boolean(user.teacherId && selectedCourse?.titularId === user.teacherId);
  const isLoading = loadingSchoolYears || loadingCourses || loadingStudents;

  function changeSchoolYear(schoolYearId: string) {
    setSelectedSchoolYearId(schoolYearId);
    setSelectedCourseId("");
    setSelectedStudentId("");
  }

  function changeCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedStudentId("");
  }

  async function generateStudentReport() {
    if (!selectedStudentId) return;
    setDownloading("student");
    try {
      await downloadStudentReport(selectedStudentId, period);
      toast.success("Boletín generado correctamente.");
    } catch (error) {
      showError(error);
    } finally {
      setDownloading(null);
    }
  }

  async function generateCourseReports() {
    if (!selectedCourseId) return;
    setDownloading("course");
    try {
      await downloadCourseReports(selectedCourseId, period);
      toast.success("Boletines del curso generados correctamente.");
    } catch (error) {
      showError(error);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="institutional-title">Boletines</h1>
        <p className="institutional-subtitle">
          Genera boletines individuales o de un curso hasta el período seleccionado.
        </p>
      </div>

      <div className="admin-card">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ReportField label="Año escolar">
            <select
              className="form-control"
              value={effectiveSchoolYearId}
              onChange={(event) => changeSchoolYear(event.target.value)}
              disabled={isLoading}
            >
              <option value="">Todos los años escolares</option>
              {schoolYears.map((schoolYear) => (
                <option key={schoolYear.id} value={schoolYear.id}>
                  {schoolYear.name}
                </option>
              ))}
            </select>
          </ReportField>

          <ReportField label="Curso">
            <select
              className="form-control"
              value={selectedCourseId}
              onChange={(event) => changeCourse(event.target.value)}
              disabled={isLoading}
            >
              <option value="">Selecciona un curso</option>
              {visibleCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </ReportField>

          <ReportField label="Período">
            <select
              className="form-control"
              value={period}
              onChange={(event) => setPeriod(Number(event.target.value))}
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  P{value}
                </option>
              ))}
            </select>
          </ReportField>

          <ReportField label="Estudiante (opcional)">
            <select
              className="form-control"
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              disabled={!selectedCourseId || isLoading}
            >
              <option value="">Selecciona un estudiante</option>
              {courseStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.listNumber}. {student.firstName} {student.lastName}
                </option>
              ))}
            </select>
          </ReportField>
        </div>
      </div>

      {selectedCourseId && !canGenerate ? (
        <div className="admin-card border-amber-200 bg-amber-50">
          <p className="text-base text-amber-800">
            Solo el maestro titular de este curso puede generar sus boletines.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <ReportAction
          icon={FileText}
          title="Boletín individual"
          description="Descarga el boletín del estudiante seleccionado en formato PDF."
          buttonLabel="Generar boletín individual"
          loadingLabel="Generando boletín..."
          loading={downloading === "student"}
          disabled={!selectedCourseId || !selectedStudentId || !canGenerate || downloading !== null}
          onClick={() => void generateStudentReport()}
        />
        <ReportAction
          icon={UsersRound}
          title="Boletines del curso"
          description={`Genera un PDF con un boletín por cada estudiante${courseStudents.length ? ` (${courseStudents.length})` : ""}.`}
          buttonLabel="Generar boletines del curso"
          loadingLabel="Generando boletines..."
          loading={downloading === "course"}
          disabled={!selectedCourseId || !canGenerate || downloading !== null}
          onClick={() => void generateCourseReports()}
        />
      </div>
    </section>
  );
}

function ReportField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-field block">
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}

function ReportAction({
  icon: Icon,
  title,
  description,
  buttonLabel,
  loadingLabel,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  description: string;
  buttonLabel: string;
  loadingLabel: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <article className="admin-card flex flex-col items-start gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-institutional-blue-light p-3 text-primary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-institutional-gray-dark">{title}</h2>
          <p className="mt-1 text-base text-institutional-gray">{description}</p>
        </div>
      </div>
      <Button className="mt-auto" disabled={disabled} onClick={onClick}>
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileDown aria-hidden="true" />}
        {loading ? loadingLabel : buttonLabel}
      </Button>
    </article>
  );
}

function ReportsLoading() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="institutional-title">Boletines</h1>
        <p className="institutional-subtitle">Prepara los datos para generar boletines.</p>
      </div>
      <div className="admin-card flex items-center gap-2 text-institutional-gray">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Cargando información...
      </div>
    </section>
  );
}

function showError(error: unknown) {
  toast.error(error instanceof ApiError ? error.message : "No se pudo generar el boletín.");
}
