import { ImportStatus, ImportType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ImportQueryDto {
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  @IsOptional()
  @IsEnum(ImportType)
  type?: ImportType;

  @IsOptional()
  @IsEnum(ImportStatus)
  status?: ImportStatus;
}
