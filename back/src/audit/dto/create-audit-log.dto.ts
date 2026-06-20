import { AuditAction } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAuditLogDto {
  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  @MinLength(1)
  entity: string;

  @IsString()
  @MinLength(1)
  entityId: string;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsOptional()
  @IsObject()
  oldValue?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  newValue?: Record<string, unknown>;
}
