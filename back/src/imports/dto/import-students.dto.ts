import { IsUUID } from 'class-validator';

export class ImportStudentsDto {
  @IsUUID()
  schoolYearId: string;
}
