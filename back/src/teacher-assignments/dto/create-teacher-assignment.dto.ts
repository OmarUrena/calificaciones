import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateTeacherAssignmentDto {
  @IsUUID()
  schoolId: string;

  @IsUUID()
  schoolYearId: string;

  @IsUUID()
  teacherId: string;

  @IsUUID()
  subjectId: string;

  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
