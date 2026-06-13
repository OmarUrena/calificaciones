import { Controller } from '@nestjs/common';

import { SchoolYearsService } from './school-years.service';

@Controller('school-years')
export class SchoolYearsController {
  constructor(private readonly schoolYearsService: SchoolYearsService) {}
}
