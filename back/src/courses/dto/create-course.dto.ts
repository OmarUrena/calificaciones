import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCourseDto {
  @IsUUID()
  schoolId: string;

  @IsUUID()
  schoolYearId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  grade: string;

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
