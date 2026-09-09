"use client";

import { downloadBlob } from "@/lib/api";

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
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  try {
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
