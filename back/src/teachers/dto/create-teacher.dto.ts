import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTeacherDto {
  @IsUUID()
  schoolId: string;

  @IsString()
  @MinLength(1)
  name: string;
}
