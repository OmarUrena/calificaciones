import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTechnicalLearningOutcomeDto {
  @IsUUID()
  schoolId: string;

  @IsUUID()
  subjectId: string;

  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;

  @IsInt()
  @Min(1)
  order: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
