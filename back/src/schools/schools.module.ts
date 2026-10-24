import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { SchoolLogoStorageService } from './school-logo-storage.service';

@Module({
  imports: [AuthModule],
  controllers: [SchoolsController],
  providers: [SchoolsService, SchoolLogoStorageService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
