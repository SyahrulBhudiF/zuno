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
  description?: string;
  artworkUrl?: string;
  kind?: "playlist" | "liked-songs" | "local";
  isSaved?: boolean;
  isEditable?: boolean;
  localPaths?: string[];
}

/**
 * YouTube stores a per-track rating, not a like flag: liking a disliked song clears the
 * dislike, and both clear to "none". A boolean cannot express that middle state.
 */
export type TrackRating = "like" | "dislike" | "none";

export interface Artist {
  id: string;
  name: string;
  artworkUrl?: string;
  subscriberCount?: string;
}

export interface ArtistPage {
  artist: Artist;
  subscribed?: boolean;
  /** Only meaningful while subscribed; YouTube resets it to "personalized" on unsubscribe. */
  notificationLevel?: ArtistNotificationLevel;
  popularSongs: Track[];
  allSongs: Track[];
  releases: Album[];
  playlists: Playlist[];
}

/**
 * How much YouTube may notify about an artist's uploads.
 *
 * "personalized" is YouTube's default and means "whatever the algorithm thinks", which is why
 * it is a distinct value rather than a midpoint between all and none.
 */
export type ArtistNotificationLevel = "all" | "personalized" | "none";

/** One entry from the account's notification inbox. */
export interface FeedNotification {
  id: string;
  text: string;
  sentAtText?: string;
  thumbnailUrl?: string;
  /** Present when the notification points at a specific video. */
  videoId?: string;
  read: boolean;
}

/**
 * Where a pasted YouTube link points, once resolved.
 *
 * Deliberately narrow: these are the four things Zuno can open. A link to anything else
 * resolves to null so the caller can fall back to treating the text as a search.
 */
export type ResolvedLink =
  | { kind: "track"; id: string }
  | { kind: "album"; id: string }
  | { kind: "playlist"; id: string }
  | { kind: "artist"; id: string };

/**
 * A search filter YouTube Music can actually encode.
 *
 * These five are what the protobuf `musicSearchType` field accepts. Podcasts, episodes and
 * profiles exist as filters on the website but ride an opaque params blob rather than this
 * enum, so they are not offered here.
 */
export type SearchCategory = "song" | "video" | "album" | "artist" | "playlist";

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
  /** Optional: sources that cannot enumerate artists let the UI derive them from albums. */
  artists?: Artist[];
  playlists: Playlist[];
  likedSongsPlaylist: Playlist;
  likedSongs: Track[];
  /**
   * Songs saved to the library that are not in Liked Songs — kept apart from `likedSongs`
   * because that list is what decides whether a track shows as liked.
   */
  librarySongs?: Track[];
  recentlyPlayed: Track[];
}
