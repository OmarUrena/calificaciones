import { IsInt, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsUUID()
  schoolId: string;

  @IsUUID()
  schoolYearId: string;

  @IsUUID()
  courseId: string;

  @IsInt()
  @Min(1)
  listNumber: number;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;
}
