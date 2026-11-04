-- Preserve existing editing behavior until an administrator closes a period.
ALTER TABLE "school_years"
ADD COLUMN "p1Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "rp1Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "p2Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "rp2Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "p3Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "rp3Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "p4Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "rp4Enabled" BOOLEAN NOT NULL DEFAULT true;
