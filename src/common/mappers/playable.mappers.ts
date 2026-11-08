import {
  PlayableTrackDto,
  PlayableAlbumDto,
  PlayableArtistDto,
  PlayablePlaylistDto,
  SearchGenreDto,
} from '../../modules/search/dto';

/**
 * Shared "playable card" mappers. Search results and recommendation
 * sections use identical shapes so the frontend can feed any item straight
 * into the player store / card components without per-endpoint glue.
 */

export function toPlayableTrack(track: {
  id: string;
  title: string;
  audioUrl: string | null;
  coverUrl: string | null;
  durationSec: number;
  isExplicit: boolean;
  artist: { id: string; stageName: string };
  album?: { id: string } | null;
}): PlayableTrackDto {
  return {
    id: track.id,
    title: track.title,
    audioUrl: track.audioUrl,
    coverUrl: track.coverUrl,
    durationSec: track.durationSec,
    artistId: track.artist.id,
    artistName: track.artist.stageName,
    albumId: track.album?.id ?? null,
    isExplicit: track.isExplicit,
  };
}

export function toPlayableAlbum(album: {
  id: string;
  title: string;
  coverUrl: string | null;
  artist: { id: string; stageName: string };
}): PlayableAlbumDto {
  return {
    id: album.id,
    title: album.title,
    coverUrl: album.coverUrl,
    artistId: album.artist.id,
    artistName: album.artist.stageName,
  };
}

export function toPlayableArtist(artist: {
  id: string;
  stageName: string;
  monthlyListeners: number;
  isVerified: boolean;
  user?: { avatarUrl?: string | null } | null;
}): PlayableArtistDto {
  return {
    id: artist.id,
    stageName: artist.stageName,
    imageUrl: artist.user?.avatarUrl ?? null,
    monthlyListeners: artist.monthlyListeners,
    isVerified: artist.isVerified,
  };
}

export function toPlayablePlaylist(playlist: {
  id: string;
  title: string;
  coverUrl: string | null;
  owner?: { username?: string | null } | null;
  _count?: { tracks?: number };
}): PlayablePlaylistDto {
  return {
    id: playlist.id,
    title: playlist.title,
    coverUrl: playlist.coverUrl,
    ownerName: playlist.owner?.username ?? null,
    trackCount: playlist._count?.tracks ?? 0,
  };
}

export function toGenreDto(genre: {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}): SearchGenreDto {
  return {
    id: genre.id,
    name: genre.name,
    slug: genre.slug,
    imageUrl: genre.imageUrl,
  };
}
