import { IsUUID } from 'class-validator';

export class ImportGradesDto {
  @IsUUID()
  schoolYearId: string;

  @IsUUID()
  courseId: string;
}
