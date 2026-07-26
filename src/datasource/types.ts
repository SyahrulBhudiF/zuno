export type TrackSource = "youtube" | "local";

export interface ArtistReference {
  id: string;
  name: string;
}

export interface Track {
  /** Set once a track has been downloaded, so the offline copy is served with the right type. */
  mimeType?: string;
  id: string;
  source: TrackSource;
  title: string;
  artist: string;
  artists?: ArtistReference[];
  album?: string;
  durationSec?: number;
  artworkUrl?: string;
  playlistItemId?: string;
  viewCount?: number;
  viewCountText?: string;
  localPath?: string;
}

export interface LyricLine {
  text: string;
  startTimeSec?: number;
  endTimeSec?: number;
}

export interface Lyrics {
  lines: LyricLine[];
  timing: "synced" | "estimated" | "none";
  sourceLabel?: string;
}

export interface Album {
  id: string;
  playlistId?: string;
  title: string;
  artist: string;
  artists?: ArtistReference[];
  artworkUrl?: string;
  releaseType?: "album" | "single" | "ep";
}

export interface Playlist {
  id: string;
  title: string;
  owner: string;
  artworkUrl?: string;
  kind?: "playlist" | "liked-songs" | "local";
  isSaved?: boolean;
  isEditable?: boolean;
  localPaths?: string[];
}

export interface Artist {
  id: string;
  name: string;
  artworkUrl?: string;
  subscriberCount?: string;
}

export interface ArtistPage {
  artist: Artist;
  subscribed?: boolean;
  popularSongs: Track[];
  allSongs: Track[];
  releases: Album[];
  playlists: Playlist[];
}

/** A category chip that leads to another browse feed. */
export interface BrowseLink {
  title: string;
  browseId: string;
}

/** One titled row on a browse page. Contents are whatever that row actually holds. */
export interface BrowseShelf {
  title: string;
  tracks: Track[];
  albums: Album[];
  playlists: Playlist[];
  artists: Artist[];
  /** Mood and genre chips, which lead to further feeds rather than to content. */
  links: BrowseLink[];
}

export interface BrowsePage {
  title: string;
  shelves: BrowseShelf[];
}

/** Either a named surface or an explicit feed reached by following a chip. */
export type BrowseTarget = BrowseSurface | { browseId: string; title: string };

/** The browse destinations Zuno knows how to open. */
export type BrowseSurface = "explore" | "charts" | "moods" | "podcasts";

export interface SearchResults {
  artists: Artist[];
  tracks: Track[];
  albums: Album[];
  playlists: Playlist[];
}

export interface TrackPage {
  tracks: Track[];
  nextPageKey?: string;
  hasMore: boolean;
}

export interface AuthPrompt {
  verificationUrl: string;
  userCode: string;
  expiresInSec: number;
}

export interface AccountProfile {
  name: string;
  artworkUrl?: string;
}

/** One channel on the signed-in account, as offered by the account switcher. */
export interface AccountOption {
  /** Opaque and stable across reloads; pass back to selectAccount. */
  id: string;
  name: string;
  artworkUrl?: string;
  isActive: boolean;
}

export interface LibrarySnapshot {
  account: AccountProfile;
  albums: Album[];
  playlists: Playlist[];
  likedSongsPlaylist: Playlist;
  likedSongs: Track[];
  recentlyPlayed: Track[];
}
