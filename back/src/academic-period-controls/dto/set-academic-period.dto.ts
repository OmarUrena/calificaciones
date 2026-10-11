import { IsBoolean, IsIn } from 'class-validator';

import { ACADEMIC_PERIOD_FIELDS, AcademicPeriodField } from '../academic-period-controls.service';

export class SetAcademicPeriodDto {
  @IsIn(ACADEMIC_PERIOD_FIELDS)
  field: AcademicPeriodField;

  @IsBoolean()
  isOpen: boolean;
}
