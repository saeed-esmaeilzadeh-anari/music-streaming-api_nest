import { Injectable } from '@nestjs/common';
import { Artist, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ArtistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ArtistCreateInput): Promise<Artist> {
    return this.prisma.artist.create({ data });
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
