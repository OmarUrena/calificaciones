import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateCourseDto {
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  grade?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  modality?: string;

  @IsOptional()
  @IsUUID()
  titularId?: string;
}
