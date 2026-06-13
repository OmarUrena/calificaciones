import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';

import { CreateAcademicGradeDto } from './create-academic-grade.dto';

export class BulkAcademicGradesDto {
  @ValidateNested({ each: true })
  @Type(() => CreateAcademicGradeDto)
  @ArrayMinSize(1)
  grades: CreateAcademicGradeDto[];
}
