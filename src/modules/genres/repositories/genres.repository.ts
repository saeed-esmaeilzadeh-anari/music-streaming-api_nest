import { Injectable } from '@nestjs/common';
import { Genre, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class GenresRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.GenreCreateInput): Promise<Genre> {
    return this.prisma.genre.create({ data });
  }

  findById(id: string): Promise<Genre | null> {
    return this.prisma.genre.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Genre | null> {
    return this.prisma.genre.findUnique({ where: { slug } });
  }

  update(id: string, data: Prisma.GenreUpdateInput): Promise<Genre> {
    return this.prisma.genre.update({ where: { id }, data });
  }

  delete(id: string): Promise<Genre> {
    return this.prisma.genre.delete({ where: { id } });
  }

  findAll(): Promise<Genre[]> {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }
}
