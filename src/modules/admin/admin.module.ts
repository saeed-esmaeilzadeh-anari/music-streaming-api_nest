import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../reports/reports.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [UsersModule, ReportsModule, AuditModule],
  controllers: [AdminController, AdminModerationController],
  providers: [AdminService],
})
export class AdminModule {}
