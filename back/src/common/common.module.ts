import { Global, Module } from '@nestjs/common';

import { PermissionsService } from './services/permissions.service';

@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class CommonModule {}
