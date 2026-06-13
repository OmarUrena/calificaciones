import { Controller } from '@nestjs/common';

import { AcademicGradesService } from './academic-grades.service';

@Controller('academic-grades')
export class AcademicGradesController {
  constructor(private readonly academicGradesService: AcademicGradesService) {}
}
