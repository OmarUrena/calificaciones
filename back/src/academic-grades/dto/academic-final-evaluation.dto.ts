import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AcademicFinalEvaluationDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  subjectId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  cec?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  ceex?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  ce?: number | null;
}
