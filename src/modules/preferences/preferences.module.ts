import { Module } from '@nestjs/common';
import {
  UserPreferencesController,
  NotificationPreferencesController,
} from './preferences.controller';
import { UserPreferencesService, NotificationPreferencesService } from './preferences.service';

/**
 * Server-synced user + notification preferences. Kept as one module because
 * both controllers share the same shape (get-or-default / upsert-patch) and
 * the same DTO conventions.
 */
@Module({
  controllers: [UserPreferencesController, NotificationPreferencesController],
  providers: [UserPreferencesService, NotificationPreferencesService],
  exports: [UserPreferencesService, NotificationPreferencesService],
})
export class PreferencesModule {}
