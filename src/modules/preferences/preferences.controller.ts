import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { UserPreferencesService, NotificationPreferencesService } from './preferences.service';
import {
  UpdateUserPreferencesDto,
  UpdateNotificationPreferencesDto,
  UserPreferencesWire,
  NotificationPreferencesWire,
} from './dto/preferences.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/preferences')
export class UserPreferencesController {
  constructor(private readonly userPreferencesService: UserPreferencesService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's appearance/locale/privacy preferences" })
  getMine(@CurrentUser('id') userId: string): Promise<UserPreferencesWire> {
    return this.userPreferencesService.getForUser(userId);
  }

  @Patch()
  @ApiOperation({
    summary: "Update the current user's preferences (partial update, upsert)",
    description:
      'Enum values are lowercase on the wire ("dark", "emerald", "fa"); ' +
      'either case is accepted on input.',
  })
  updateMine(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesWire> {
    return this.userPreferencesService.updateForUser(userId, dto);
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications/preferences')
export class NotificationPreferencesController {
  constructor(private readonly notificationPreferencesService: NotificationPreferencesService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's notification preferences" })
  getMine(@CurrentUser('id') userId: string): Promise<NotificationPreferencesWire> {
    return this.notificationPreferencesService.getForUser(userId);
  }

  @Patch()
  @ApiOperation({ summary: "Update the current user's notification preferences" })
  updateMine(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesWire> {
    return this.notificationPreferencesService.updateForUser(userId, dto);
  }
}
