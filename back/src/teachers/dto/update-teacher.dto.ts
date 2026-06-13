import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
