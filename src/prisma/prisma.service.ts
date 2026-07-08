import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Wraps PrismaClient as an injectable NestJS provider.
 * Handles lifecycle hooks so connections are established/torn down
 * cleanly alongside the Nest application lifecycle.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }

  /**
   * Utility for tests/dev to wipe tables. Never call in production.
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase() cannot run in production');
    }
    const tableNames = Object.values(Prisma.ModelName);
    return Promise.all(
      tableNames.map((name) => this.$executeRawUnsafe(`TRUNCATE TABLE "${name}" CASCADE;`)),
    );
  }
}
