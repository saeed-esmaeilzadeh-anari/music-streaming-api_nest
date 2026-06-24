import { Injectable } from '@nestjs/common';
import { Prisma, Track } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const trackWithArtist = {
  include: { artist: { select: { id: true, stageName: true } } },
} satisfies Prisma.TrackDefaultArgs;

export type TrackWithArtist = Prisma.TrackGetPayload<typeof trackWithArtist>;

@Injectable()
export class TracksRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TrackCreateInput): Promise<TrackWithArtist> {
    return this.prisma.track.create({ data, ...trackWithArtist });
  }

  findById(id: string): Promise<TrackWithArtist | null> {
    return this.prisma.track.findUnique({ where: { id }, ...trackWithArtist });
  }

  update(id: string, data: Prisma.TrackUpdateInput): Promise<TrackWithArtist> {
    return this.prisma.track.update({ where: { id }, data, ...trackWithArtist });
  }

  delete(id: string): Promise<Track> {
    return this.prisma.track.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.TrackWhereInput;
    orderBy?: Prisma.TrackOrderByWithRelationInput;
  }): Promise<TrackWithArtist[]> {
    return this.prisma.track.findMany({ ...params, ...trackWithArtist });
  }

  count(where?: Prisma.TrackWhereInput): Promise<number> {
    return this.prisma.track.count({ where });
  }

  incrementPlayCount(id: string): Promise<Track> {
    return this.prisma.track.update({
      where: { id },
      data: { playCount: { increment: 1 } },
    });
  }

  setGenres(trackId: string, genreIds: string[]): Promise<unknown> {
    return this.prisma.$transaction([
      this.prisma.trackGenre.deleteMany({ where: { trackId } }),
      this.prisma.trackGenre.createMany({
        data: genreIds.map((genreId) => ({ trackId, genreId })),
        skipDuplicates: true,
      }),
    ]);
  }
}
