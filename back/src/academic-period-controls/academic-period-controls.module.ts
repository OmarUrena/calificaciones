import { Module } from '@nestjs/common';

import { AcademicPeriodControlsController } from './academic-period-controls.controller';
import { AcademicPeriodControlsService } from './academic-period-controls.service';

@Module({
  controllers: [AcademicPeriodControlsController],
  providers: [AcademicPeriodControlsService],
  exports: [AcademicPeriodControlsService],
})
export class AcademicPeriodControlsModule {}
