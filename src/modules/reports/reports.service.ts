import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { CreateReportDto, ReportTargetTypeWire, ResolveActionWire } from './dto';

/**
 * User-facing reports plus the query/resolve half used by the moderation
 * panel. A user can file one report per (reporter, targetType, targetId) -
 * enforced by a unique constraint and surfaced as a clean 409.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    try {
      const report = await this.prisma.report.create({
        data: {
          reporterId,
          targetType: dto.targetType as never,
          targetId: dto.targetId,
          reason: dto.reason as never,
          details: dto.details,
        },
      });
      return this.toWire(report);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already reported this content.');
      }
      throw error;
    }
  }

  async listOwn(reporterId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, totalItems] = await Promise.all([
      this.prisma.report.findMany({
        where: { reporterId },
        skip: query.skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where: { reporterId } }),
    ]);

    return new PaginatedResultDto(
      items.map((r) => this.toWire(r)),
      totalItems,
      page,
      limit,
    );
  }

  // ── Moderation panel ────────────────────────────────────────────────

  async listForModeration(query: PaginationQueryDto, status?: ReportStatus) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ReportWhereInput = status ? { status } : {};

    const [items, totalItems] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip: query.skip,
        take: limit,
        orderBy: { createdAt: 'asc' }, // oldest open reports first
        include: {
          reporter: { select: { id: true, username: true } },
          resolvedBy: { select: { id: true, username: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    return new PaginatedResultDto(
      items.map((r) => this.toWire(r)),
      totalItems,
      page,
      limit,
    );
  }

  async resolve(
    reportId: string,
    moderatorId: string,
    action: ResolveActionWire,
    resolutionNote?: string,
  ) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    const status: ReportStatus = action === ResolveActionWire.RESOLVE ? 'RESOLVED' : 'DISMISSED';

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status, resolutionNote, resolvedById: moderatorId },
    });

    await this.auditLogService.record({
      actorId: moderatorId,
      action: action === ResolveActionWire.RESOLVE ? 'report.resolved' : 'report.dismissed',
      entityType: 'Report',
      entityId: reportId,
      metadata: {
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        note: resolutionNote ?? null,
      },
    });

    return this.toWire(updated);
  }

  private async assertTargetExists(
    targetType: ReportTargetTypeWire,
    targetId: string,
  ): Promise<void> {
    let exists: boolean;
    switch (targetType) {
      case ReportTargetTypeWire.TRACK:
        exists = Boolean(await this.prisma.track.count({ where: { id: targetId } }));
        break;
      case ReportTargetTypeWire.ALBUM:
        exists = Boolean(await this.prisma.album.count({ where: { id: targetId } }));
        break;
      case ReportTargetTypeWire.PLAYLIST:
        exists = Boolean(await this.prisma.playlist.count({ where: { id: targetId } }));
        break;
      case ReportTargetTypeWire.COMMENT:
        exists = Boolean(await this.prisma.comment.count({ where: { id: targetId } }));
        break;
      case ReportTargetTypeWire.USER:
        exists = Boolean(await this.prisma.user.count({ where: { id: targetId } }));
        break;
      case ReportTargetTypeWire.ARTIST:
        exists = Boolean(await this.prisma.artist.count({ where: { id: targetId } }));
        break;
      default:
        exists = false;
    }
    if (!exists) {
      throw new NotFoundException('Reported content not found.');
    }
  }

  private toWire(report: Record<string, unknown>) {
    return plainToInstance(ReportWireDto, report, { excludeExtraneousValues: false });
  }
}

/**
 * Plain pass-through shape (no @Expose mapping needed) - declared only to
 * give the Swagger layer a named type and the compiler a return type.
 */
export class ReportWireDto {
  id!: string;
  reporterId!: string;
  targetType!: string;
  targetId!: string;
  reason!: string;
  details?: string | null;
  status!: string;
  resolutionNote?: string | null;
  resolvedById?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  reporter?: { id: string; username: string } | null;
  resolvedBy?: { id: string; username: string } | null;
}
