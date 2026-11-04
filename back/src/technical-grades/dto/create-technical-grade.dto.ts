import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateTechnicalGradeDto {
  @IsUUID()
  schoolId: string;

  @IsUUID()
  schoolYearId: string;

  @IsUUID()
  courseId: string;

  @IsUUID()
  studentId: string;

  @IsUUID()
  subjectId: string;

  @IsUUID()
  learningOutcomeId: string;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  ordinaryScore?: number;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  recovery1Score?: number;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  recovery2Score?: number;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  specialScore?: number;
}
