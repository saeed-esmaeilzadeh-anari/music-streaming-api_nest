import { ApiProperty } from '@nestjs/swagger';

export class SearchResultDto {
  @ApiProperty()
  tracks: Array<{ id: string; title: string; artistName: string }>;

  @ApiProperty()
  albums: Array<{ id: string; title: string; artistName: string }>;

  @ApiProperty()
  artists: Array<{ id: string; stageName: string }>;

  @ApiProperty()
  playlists: Array<{ id: string; title: string }>;
}
