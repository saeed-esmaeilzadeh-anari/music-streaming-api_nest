import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardStatsDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  totalArtists: number;

  @ApiProperty()
  totalTracks: number;

  @ApiProperty()
  totalAlbums: number;

  @ApiProperty()
  activeSubscriptions: number;
}
