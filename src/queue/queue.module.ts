import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';

/**
 * Registers the shared BullMQ Redis connection once at the root level.
 * Individual feature modules (upload, notifications, payments) register
 * their own queues via BullModule.registerQueue({ name: QUEUE_NAMES.X })
 * and inject @InjectQueue(QUEUE_NAMES.X) - they don't need to repeat
 * connection config because BullModule.forRootAsync is global.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
          db: config.get<number>('redis.db'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86400 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.TRACK_PROCESSING },
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.PAYMENTS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
