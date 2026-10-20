import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { CreateTechnicalLearningOutcomeDto } from './create-technical-learning-outcome.dto';

export class CreateLearningOutcomesBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTechnicalLearningOutcomeDto)
  items: CreateTechnicalLearningOutcomeDto[];
}

class LearningOutcomeWeightDto {
  @IsUUID()
  id: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weight: number;
}

export class UpdateLearningOutcomeWeightsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: LearningOutcomeWeightDto) => item.id)
  @ValidateNested({ each: true })
  @Type(() => LearningOutcomeWeightDto)
  items: LearningOutcomeWeightDto[];
}
