import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateTechnicalGradeDto {
  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  ordinaryScore?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  recovery1Score?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  recovery2Score?: number | null;

  @IsOptional()
  @IsInt({ message: 'La calificación debe ser un número entero.' })
  @Min(0)
  specialScore?: number | null;
}
