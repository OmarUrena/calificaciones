import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { IsUserEmail } from '../../common/decorators/is-user-email.decorator';

export class UpdateUserDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string | null;

  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  @IsOptional()
  @IsUserEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  fullName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
