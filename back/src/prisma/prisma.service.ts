import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const connectOnBoot = this.configService.get<boolean>('database.connectOnBoot', false);

    if (!connectOnBoot) {
      this.logger.log('Skipping PostgreSQL boot connection check');
      return;
    }

    await this.$connect();
    this.logger.log('Connected to PostgreSQL through Prisma');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
