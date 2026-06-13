import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTechnicalGradeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  ordinaryScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recovery1Score?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recovery2Score?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  specialScore?: number;
}
