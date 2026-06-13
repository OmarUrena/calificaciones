import { IsInt, Max, Min } from 'class-validator';

export class ReportCardQueryDto {
  @IsInt()
  @Min(1)
  @Max(4)
  period: number;
}
