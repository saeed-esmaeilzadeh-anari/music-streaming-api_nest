import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * Wraps EventEmitterModule.forRoot() so app.module.ts stays declarative.
 * wildcard/verboseMemoryLeak are handy in dev to catch unbounded listener growth.
 */
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: process.env.NODE_ENV !== 'production',
      ignoreErrors: false,
    }),
  ],
  exports: [EventEmitterModule],
})
export class DomainEventsModule {}
