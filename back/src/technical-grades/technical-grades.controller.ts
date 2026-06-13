import { Controller } from '@nestjs/common';

import { TechnicalGradesService } from './technical-grades.service';

@Controller('technical-grades')
export class TechnicalGradesController {
  constructor(private readonly technicalGradesService: TechnicalGradesService) {}
}
