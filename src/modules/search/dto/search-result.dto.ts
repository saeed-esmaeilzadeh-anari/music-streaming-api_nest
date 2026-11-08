import { ApiProperty } from '@nestjs/swagger';

/**
 * Track card shaped for direct playback: the frontend player needs the
 * audio URL, cover, duration and artist/album references up front so a
 * search result can be queued and played without a follow-up fetch.
 */
export class PlayableTrackDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true, type: String })
  audioUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  coverUrl: string | null;

  @ApiProperty()
  durationSec: number;

  @ApiProperty()
  artistId: string;

  @ApiProperty()
  artistName: string;

  @ApiProperty({ nullable: true, type: String })
  albumId: string | null;

  @ApiProperty()
  isExplicit: boolean;
}

export class PlayableAlbumDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true, type: String })
  coverUrl: string | null;

  @ApiProperty()
  artistId: string;

  @ApiProperty()
  artistName: string;
}

export class PlayableArtistDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  stageName: string;

  @ApiProperty({ nullable: true, type: String })
  imageUrl: string | null;

  @ApiProperty()
  monthlyListeners: number;

  @ApiProperty()
  isVerified: boolean;
}

export class PlayablePlaylistDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true, type: String })
  coverUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  ownerName: string | null;

  @ApiProperty()
  trackCount: number;
}

export class SearchGenreDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ nullable: true, type: String })
  imageUrl: string | null;
}

export class SearchResultDto {
  @ApiProperty({ type: [PlayableTrackDto] })
  tracks: PlayableTrackDto[];

  @ApiProperty({ type: [PlayableAlbumDto] })
  albums: PlayableAlbumDto[];

  @ApiProperty({ type: [PlayableArtistDto] })
  artists: PlayableArtistDto[];

  @ApiProperty({ type: [PlayablePlaylistDto] })
  playlists: PlayablePlaylistDto[];

  @ApiProperty({ type: [SearchGenreDto] })
  genres: SearchGenreDto[];
}
