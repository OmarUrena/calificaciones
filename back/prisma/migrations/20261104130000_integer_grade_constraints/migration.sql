BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Preserve historical fractional grades for manual review. NOT VALID skips the
-- historical scan while enforcing the constraint on every new or updated row.
-- Keep numeric storage until those historical exceptions have been corrected.
ALTER TABLE "academic_grades"
  ADD CONSTRAINT "academic_grades_integer_scores" CHECK (
    ("p1" IS NULL OR "p1" = trunc("p1")) AND
    ("rp1" IS NULL OR "rp1" = trunc("rp1")) AND
    ("p2" IS NULL OR "p2" = trunc("p2")) AND
    ("rp2" IS NULL OR "rp2" = trunc("rp2")) AND
    ("p3" IS NULL OR "p3" = trunc("p3")) AND
    ("rp3" IS NULL OR "rp3" = trunc("rp3")) AND
    ("p4" IS NULL OR "p4" = trunc("p4")) AND
    ("rp4" IS NULL OR "rp4" = trunc("rp4"))
  ) NOT VALID;

ALTER TABLE "technical_grades"
  ADD CONSTRAINT "technical_grades_integer_scores" CHECK (
    ("ordinaryScore" IS NULL OR "ordinaryScore" = trunc("ordinaryScore")) AND
    ("recovery1Score" IS NULL OR "recovery1Score" = trunc("recovery1Score")) AND
    ("recovery2Score" IS NULL OR "recovery2Score" = trunc("recovery2Score")) AND
    ("specialScore" IS NULL OR "specialScore" = trunc("specialScore"))
  ) NOT VALID;

COMMIT;
