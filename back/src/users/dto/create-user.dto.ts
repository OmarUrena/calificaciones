import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { IsUserEmail } from '../../common/decorators/is-user-email.decorator';

export class CreateUserDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsUserEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsString()
  @MinLength(1)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  fullName: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
