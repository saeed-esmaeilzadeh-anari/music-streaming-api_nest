import { Injectable } from '@nestjs/common';
import { Album, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AlbumsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AlbumCreateInput): Promise<Album> {
    return this.prisma.album.create({ data });
  }

  findById(id: string): Promise<Album | null> {
    return this.prisma.album.findUnique({ where: { id }, include: { tracks: true } });
  }

  update(id: string, data: Prisma.AlbumUpdateInput): Promise<Album> {
    return this.prisma.album.update({ where: { id }, data });
  }

  delete(id: string): Promise<Album> {
    return this.prisma.album.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.AlbumWhereInput;
    orderBy?: Prisma.AlbumOrderByWithRelationInput;
  }): Promise<Album[]> {
    return this.prisma.album.findMany(params);
  }

  count(where?: Prisma.AlbumWhereInput): Promise<number> {
    return this.prisma.album.count({ where });
  }

  setGenres(albumId: string, genreIds: string[]) {
    return this.prisma.$transaction([
      this.prisma.albumGenre.deleteMany({ where: { albumId } }),
      this.prisma.albumGenre.createMany({
        data: genreIds.map((genreId) => ({ albumId, genreId })),
        skipDuplicates: true,
      }),
    ]);
  }
}
