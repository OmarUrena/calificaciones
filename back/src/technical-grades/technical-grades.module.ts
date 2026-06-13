import { Module } from '@nestjs/common';

import { TechnicalGradesController } from './technical-grades.controller';
import { TechnicalGradesService } from './technical-grades.service';

@Module({
  controllers: [TechnicalGradesController],
  providers: [TechnicalGradesService],
  exports: [TechnicalGradesService],
})
export class TechnicalGradesModule {}
