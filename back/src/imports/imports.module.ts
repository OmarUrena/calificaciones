import { Module } from '@nestjs/common';

import { AcademicGradesModule } from '../academic-grades/academic-grades.module';
import { TechnicalGradesModule } from '../technical-grades/technical-grades.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [AcademicGradesModule, TechnicalGradesModule],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
