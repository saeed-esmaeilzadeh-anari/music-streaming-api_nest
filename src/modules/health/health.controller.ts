import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../../redis/redis-cache.service';

interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSec: number;
  timestamp: string;
  dependencies: { database: 'up' | 'down'; cache: 'up' | 'down' };
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Liveness/readiness probe for load balancers and uptime monitors.
   * Always returns 200: `status: degraded` plus per-dependency state lets
   * orchestrators distinguish "app alive, DB down" from a hard failure.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Service health with dependency states' })
  async check(): Promise<HealthReport> {
    const dependencies: HealthReport['dependencies'] = { database: 'down', cache: 'down' };

    const [dbOk, cacheOk] = await Promise.all([
      this.prisma.user
        .count({ take: 1 })
        .then(() => true)
        .catch(() => false),
      this.cacheService
        .get('health:probe')
        .then(() => true)
        .catch(() => false),
    ]);

    dependencies.database = dbOk ? 'up' : 'down';
    dependencies.cache = cacheOk ? 'up' : 'down';

    const status: HealthReport['status'] = dependencies.database === 'up' ? 'ok' : 'degraded';

    return {
      status,
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }
}
