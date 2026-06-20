import { Type } from 'class-transformer';
import { ArrayMinSize, ValidateNested } from 'class-validator';

import { CreateTechnicalGradeDto } from './create-technical-grade.dto';

export class BulkTechnicalGradesDto {
  @ValidateNested({ each: true })
  @Type(() => CreateTechnicalGradeDto)
  @ArrayMinSize(1)
  grades: CreateTechnicalGradeDto[];
}
