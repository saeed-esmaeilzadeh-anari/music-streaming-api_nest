import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportsService } from '../reports/reports.service';
import { AuditLogService } from '../audit/audit.service';
import { AdminService } from './admin.service';
import { ResolveReportDto, SetArtistVerificationDto } from '../reports/dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/constants/role.enum';

/**
 * Moderation surface. Split from AdminController so the base @Roles(ADMIN)
 * there does not silently lock moderators out: report triage is a
 * moderator-level task, while audit-log review stays admin-only.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminModerationController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly auditLogService: AuditLogService,
    private readonly adminService: AdminService,
  ) {}

  // ── Reports ─────────────────────────────────────────────────────────

  @Get('reports')
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiQuery({ name: 'status', enum: ['OPEN', 'RESOLVED', 'DISMISSED'], required: false })
  @ApiOperation({ summary: 'List content reports (moderator/admin)' })
  listReports(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: 'OPEN' | 'RESOLVED' | 'DISMISSED',
  ) {
    return this.reportsService.listForModeration(query, status);
  }

  @Patch('reports/:id')
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiOperation({ summary: 'Resolve or dismiss a report (moderator/admin)' })
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') moderatorId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportsService.resolve(id, moderatorId, dto.action, dto.resolutionNote);
  }

  // ── Artist verification ─────────────────────────────────────────────

  @Get('artists')
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiQuery({
    name: 'verification',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    required: false,
  })
  @ApiOperation({ summary: 'List artists filtered by verification status' })
  listArtists(
    @Query() query: PaginationQueryDto,
    @Query('verification') verification?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) {
    return this.adminService.listArtistsByVerification(query, verification);
  }

  @Patch('artists/:id/verification')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve or reject an artist profile (admin)' })
  async setArtistVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: SetArtistVerificationDto,
  ) {
    const result = await this.adminService.setArtistVerification(id, dto.status);
    await this.auditLogService.record({
      actorId: adminId,
      action: 'artist.verification_changed',
      entityType: 'Artist',
      entityId: id,
      metadata: { status: dto.status },
    });
    return result;
  }

  // ── Audit trail ─────────────────────────────────────────────────────

  @Get('audit-logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Browse the privileged-action audit trail (admin)' })
  listAuditLogs(@Query() query: PaginationQueryDto) {
    return this.auditLogService.list(query);
  }
}
