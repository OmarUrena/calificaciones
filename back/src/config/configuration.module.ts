import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import appConfig from './env/app.config';
import databaseConfig from './env/database.config';
import reportsConfig from './env/reports.config';
import supabaseConfig from './env/supabase.config';
import { envValidationSchema } from './env/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [appConfig, databaseConfig, reportsConfig, supabaseConfig],
      validationSchema: envValidationSchema,
    }),
  ],
})
export class ConfigurationModule {}
