import { SubjectType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSubjectDto {
  @IsUUID()
  schoolId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(SubjectType)
  type: SubjectType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
