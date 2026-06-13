import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateAcademicGradeDto {
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

  @IsInt()
  @Min(1)
  @Max(4)
  blockNumber: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  p1?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rp1?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  p2?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rp2?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  p3?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rp3?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  p4?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rp4?: number;
}
