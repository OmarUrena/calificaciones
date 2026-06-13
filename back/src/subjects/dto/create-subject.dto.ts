import { SubjectType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @IsUUID()
  schoolId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(SubjectType)
  type: SubjectType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
