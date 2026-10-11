CREATE TABLE "academic_period_controls" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "p1Open" BOOLEAN NOT NULL DEFAULT true,
    "rp1Open" BOOLEAN NOT NULL DEFAULT true,
    "p2Open" BOOLEAN NOT NULL DEFAULT true,
    "rp2Open" BOOLEAN NOT NULL DEFAULT true,
    "p3Open" BOOLEAN NOT NULL DEFAULT true,
    "rp3Open" BOOLEAN NOT NULL DEFAULT true,
    "p4Open" BOOLEAN NOT NULL DEFAULT true,
    "rp4Open" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "academic_period_controls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_period_controls_schoolId_schoolYearId_key" ON "academic_period_controls"("schoolId", "schoolYearId");

ALTER TABLE "academic_period_controls" ADD CONSTRAINT "academic_period_controls_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_period_controls" ADD CONSTRAINT "academic_period_controls_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "school_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
