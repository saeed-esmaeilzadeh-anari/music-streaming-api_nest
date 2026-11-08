import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail for privileged actions (moderation decisions,
 * artist verification, account status changes). Recording never throws:
 * an audit write failure must not fail the business action it observes.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log entry "${entry.action}": ${error}`);
    }
  }

  async list(query: PaginationQueryDto): Promise<PaginatedResultDto<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip: query.skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, username: true, role: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);

    return new PaginatedResultDto(
      items.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        createdAt: item.createdAt,
        actor: item.actor
          ? { id: item.actor.id, username: item.actor.username, role: item.actor.role }
          : null,
      })),
      totalItems,
      page,
      limit,
    );
  }
}
