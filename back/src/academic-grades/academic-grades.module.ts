import { Module } from '@nestjs/common';

import { AcademicGradesController } from './academic-grades.controller';
import { AcademicGradesService } from './academic-grades.service';

@Module({
  controllers: [AcademicGradesController],
  providers: [AcademicGradesService],
  exports: [AcademicGradesService],
})
export class AcademicGradesModule {}
