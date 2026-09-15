import { Module } from '@nestjs/common';

import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { SchoolLogoStorageService } from './school-logo-storage.service';

@Module({
  controllers: [SchoolsController],
  providers: [SchoolsService, SchoolLogoStorageService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
