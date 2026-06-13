import { SubjectType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(SubjectType)
  type?: SubjectType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
