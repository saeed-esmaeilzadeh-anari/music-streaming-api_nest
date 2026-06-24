import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Marked @Global so PrismaService is available everywhere without
 * needing to re-import PrismaModule in every feature module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
