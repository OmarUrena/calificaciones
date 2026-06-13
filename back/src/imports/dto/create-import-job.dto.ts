import { ImportStatus, ImportType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateImportJobDto {
  @IsUUID()
  schoolId: string;

  @IsUUID()
  schoolYearId: string;

  @IsUUID()
  userId: string;

  @IsEnum(ImportType)
  type: ImportType;

  @IsString()
  @MinLength(1)
  fileName: string;

  @IsOptional()
  @IsEnum(ImportStatus)
  status?: ImportStatus;
}
