import { IsOptional, IsUUID } from 'class-validator';

export class ImportGradesDto {
  @IsUUID()
  schoolYearId: string;

  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
