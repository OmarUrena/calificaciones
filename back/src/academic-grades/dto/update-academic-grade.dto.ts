import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateAcademicGradeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  p1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rp1?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  p2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rp2?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  p3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rp3?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  p4?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rp4?: number | null;
}
