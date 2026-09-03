import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTechnicalGradeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  ordinaryScore?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recovery1Score?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recovery2Score?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  specialScore?: number | null;
}
