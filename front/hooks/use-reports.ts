"use client";

import { downloadBlob, downloadFile } from "@/lib/api";

export async function downloadSubjectGradesReport(assignmentId: string, period?: number) {
  const query = period === undefined ? "" : `?period=${period}`;
  const { blob, filename } = await downloadFile(`/reports/assignments/${assignmentId}/grades${query}`);
  saveReport(blob, filename ?? `calificaciones-${assignmentId}-${period ? `P${period}` : "por-RA"}.pdf`);
}

export async function downloadStudentReport(studentId: string, period: number) {
  await downloadReport(
    `/reports/students/${studentId}/report-card?period=${period}`,
    `boletin-estudiante-${studentId}-P${period}.pdf`,
  );
}

export async function downloadCourseReports(courseId: string, period: number) {
  await downloadReport(
    `/reports/courses/${courseId}/report-cards?period=${period}`,
    `boletines-curso-${courseId}-P${period}.pdf`,
  );
}

async function downloadReport(path: string, fileName: string) {
  const blob = await downloadBlob(path);
  saveReport(blob, fileName);
}

function saveReport(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  try {
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
