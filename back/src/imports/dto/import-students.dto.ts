import { IsOptional, IsUUID } from 'class-validator';

export class ImportStudentsDto {
  @IsUUID()
  schoolYearId: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;
}
