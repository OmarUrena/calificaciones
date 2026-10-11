import { Module } from '@nestjs/common';
import { AcademicPeriodControlsModule } from '../academic-period-controls/academic-period-controls.module';

import { AcademicGradesController } from './academic-grades.controller';
import { AcademicGradesService } from './academic-grades.service';

@Module({
  imports: [AcademicPeriodControlsModule],
  controllers: [AcademicGradesController],
  providers: [AcademicGradesService],
  exports: [AcademicGradesService],
})
export class AcademicGradesModule {}
