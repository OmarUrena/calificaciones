import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSchoolYearDto {
  @IsUUID()
  schoolId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
