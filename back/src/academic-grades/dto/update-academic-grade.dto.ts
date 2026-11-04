import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateAcademicGradeDto {
  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  @Max(100)
  p1?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  @Max(100)
  rp1?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  @Max(100)
  p2?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  @Max(100)
  rp2?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  @Max(100)
  p3?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  @Max(100)
  rp3?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  @Max(100)
  p4?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  @Max(100)
  rp4?: number | null;
}
