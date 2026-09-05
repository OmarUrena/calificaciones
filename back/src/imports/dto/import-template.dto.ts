import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ImportTemplateDto {
  @IsIn(['students', 'academic', 'technical'])
  type: 'students' | 'academic' | 'technical';

  @IsUUID()
  schoolYearId: string;

  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
