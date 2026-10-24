import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateTeacherAssignmentDto {
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
