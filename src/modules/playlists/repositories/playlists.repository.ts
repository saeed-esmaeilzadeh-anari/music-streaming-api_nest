import { Injectable } from '@nestjs/common';
import { Playlist, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PlaylistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.PlaylistCreateInput): Promise<Playlist> {
    return this.prisma.playlist.create({ data });
  }

  findById(id: string): Promise<Playlist | null> {
    return this.prisma.playlist.findUnique({
      where: { id },
      include: {
        tracks: {
          orderBy: { position: 'asc' },
          include: { track: { include: { artist: { select: { id: true, stageName: true } } } } },
        },
      },
    });
  }

  update(id: string, data: Prisma.PlaylistUpdateInput): Promise<Playlist> {
    return this.prisma.playlist.update({ where: { id }, data });
  }

  delete(id: string): Promise<Playlist> {
    return this.prisma.playlist.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PlaylistWhereInput;
    orderBy?: Prisma.PlaylistOrderByWithRelationInput;
  }): Promise<Playlist[]> {
    return this.prisma.playlist.findMany(params);
  }

  count(where?: Prisma.PlaylistWhereInput): Promise<number> {
    return this.prisma.playlist.count({ where });
  }

  async getMaxTrackPosition(playlistId: string): Promise<number> {
    const last = await this.prisma.playlistTrack.findFirst({
      where: { playlistId },
      orderBy: { position: 'desc' },
    });
    return last ? last.position : -1;
  }

  addTrack(playlistId: string, trackId: string, position: number) {
    return this.prisma.playlistTrack.create({
      data: { playlistId, trackId, position },
    });
  }

  removeTrack(playlistId: string, trackId: string) {
    return this.prisma.playlistTrack.delete({
      where: { playlistId_trackId: { playlistId, trackId } },
    });
  }

  updateTrackPosition(playlistId: string, trackId: string, position: number) {
    return this.prisma.playlistTrack.update({
      where: { playlistId_trackId: { playlistId, trackId } },
      data: { position },
    });
  }

  findTrackEntry(playlistId: string, trackId: string) {
    return this.prisma.playlistTrack.findUnique({
      where: { playlistId_trackId: { playlistId, trackId } },
    });
  }
}
