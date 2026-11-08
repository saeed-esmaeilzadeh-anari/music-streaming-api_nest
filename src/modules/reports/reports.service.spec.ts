import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const reporterId = 'reporter-1';
  const moderatorId = 'mod-1';

  let prisma: Record<string, Record<string, jest.Mock>>;
  let audit: { record: jest.Mock };
  let service: ReportsService;

  const report = {
    id: 'report-1',
    reporterId,
    targetType: 'TRACK',
    targetId: 'track-1',
    reason: 'SPAM',
    details: 'spammy',
    status: 'OPEN',
    resolutionNote: null,
    resolvedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      report: {
        create: jest.fn().mockResolvedValue(report),
        findUnique: jest.fn().mockResolvedValue(report),
        findMany: jest.fn().mockResolvedValue([report]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({ ...report, status: 'RESOLVED' }),
      },
      track: { count: jest.fn().mockResolvedValue(1) },
      album: { count: jest.fn().mockResolvedValue(0) },
      playlist: { count: jest.fn().mockResolvedValue(0) },
      comment: { count: jest.fn().mockResolvedValue(0) },
      user: { count: jest.fn().mockResolvedValue(0) },
      artist: { count: jest.fn().mockResolvedValue(0) },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ReportsService(prisma as unknown as never, audit as unknown as never);
  });

  it('creates a report for an existing target', async () => {
    const result = await service.create(reporterId, {
      targetType: 'TRACK' as never,
      targetId: 'track-1',
      reason: 'SPAM' as never,
      details: 'spammy',
    } as never);

    expect(prisma.report.create).toHaveBeenCalledWith({
      data: {
        reporterId,
        targetType: 'TRACK',
        targetId: 'track-1',
        reason: 'SPAM',
        details: 'spammy',
      },
    });
    expect(result).toMatchObject({ id: 'report-1', status: 'OPEN' });
  });

  it('rejects reports for missing targets with 404', async () => {
    prisma.track.count.mockResolvedValue(0);

    await expect(
      service.create(reporterId, {
        targetType: 'TRACK' as never,
        targetId: 'missing',
        reason: 'SPAM' as never,
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('surfaces duplicate reports as 409', async () => {
    prisma.report.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique constraint violated', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(reporterId, {
        targetType: 'TRACK' as never,
        targetId: 'track-1',
        reason: 'SPAM' as never,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('resolves a report, stamps the moderator and writes an audit entry', async () => {
    const result = await service.resolve('report-1', moderatorId, 'RESOLVE' as never, 'removed');

    expect(prisma.report.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: { status: 'RESOLVED', resolutionNote: 'removed', resolvedById: moderatorId },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: moderatorId, action: 'report.resolved' }),
    );
    expect(result).toMatchObject({ status: 'RESOLVED' });
  });

  it('rejects resolution of a missing report', async () => {
    prisma.report.findUnique.mockResolvedValue(null);

    await expect(
      service.resolve('missing', moderatorId, 'DISMISS' as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('dismisses with the DISMISSED status and audit action', async () => {
    prisma.report.update.mockResolvedValue({ ...report, status: 'DISMISSED' });

    await service.resolve('report-1', moderatorId, 'DISMISS' as never);

    expect(prisma.report.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: { status: 'DISMISSED', resolutionNote: undefined, resolvedById: moderatorId },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.dismissed' }),
    );
  });
});
