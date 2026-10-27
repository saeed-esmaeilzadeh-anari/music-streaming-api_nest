import { Injectable } from '@nestjs/common';
import { Artist, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type CreateArtistForUserResult =
  | { status: 'missing-user' }
  | { status: 'existing'; artist: Artist }
  | { status: 'created'; artist: Artist };

@Injectable()
export class ArtistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ArtistCreateInput): Promise<Artist> {
    return this.prisma.artist.create({ data });
  }

  /**
   * Creates the artist profile and upgrades a listener to ARTIST in one
   * transaction. Staff roles are intentionally preserved. The unique
   * userId constraint remains the final guard against concurrent requests.
   */
  createForUser(
    userId: string,
    data: Pick<Prisma.ArtistCreateInput, 'stageName' | 'bio'>,
  ): Promise<CreateArtistForUserResult> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, deletedAt: true },
      });

      if (!user || user.deletedAt) {
        return { status: 'missing-user' } as const;
      }

      const existing = await tx.artist.findUnique({ where: { userId } });
      if (existing) {
        return { status: 'existing', artist: existing } as const;
      }

      const artist = await tx.artist.create({
        data: {
          stageName: data.stageName,
          bio: data.bio,
          user: { connect: { id: userId } },
        },
      });

      if (user.role === 'LISTENER') {
        await tx.user.update({
          where: { id: userId },
          data: { role: 'ARTIST' },
        });
      }

      return { status: 'created', artist } as const;
    });
  }

  findById(id: string): Promise<Artist | null> {
    return this.prisma.artist.findUnique({ where: { id } });
  }

  findByUserId(userId: string): Promise<Artist | null> {
    return this.prisma.artist.findUnique({ where: { userId } });
  }

  update(id: string, data: Prisma.ArtistUpdateInput): Promise<Artist> {
    return this.prisma.artist.update({ where: { id }, data });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ArtistWhereInput;
    orderBy?: Prisma.ArtistOrderByWithRelationInput;
  }): Promise<Artist[]> {
    return this.prisma.artist.findMany(params);
  }

  count(where?: Prisma.ArtistWhereInput): Promise<number> {
    return this.prisma.artist.count({ where });
  }
}
