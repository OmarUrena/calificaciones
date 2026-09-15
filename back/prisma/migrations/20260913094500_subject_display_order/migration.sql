-- Add the global report order for each school's subjects.
ALTER TABLE "subjects"
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 1000;

-- Initialize the standard academic order for existing subjects.
UPDATE "subjects"
SET "displayOrder" = CASE
  WHEN "name" ILIKE 'Lengua Espa_ola%' THEN 10
  WHEN "name" ILIKE 'Matem_tica%' THEN 20
  WHEN "name" ILIKE 'Ciencias Sociales%' THEN 30
  WHEN "name" ILIKE 'Ciencias de la Naturaleza%' THEN 40
  WHEN "name" ILIKE '%Ingl_s%' THEN 50
  WHEN "name" ILIKE '%Franc_s%' THEN 60
  WHEN "name" ILIKE 'Educaci_n F_sica%' THEN 70
  WHEN "name" ILIKE 'Educaci_n Art_stica%' THEN 80
  WHEN "name" ILIKE 'Formaci_n Integral%Humana%Religiosa%' THEN 90
  ELSE "displayOrder"
END
WHERE "type" = 'ACADEMIC';
