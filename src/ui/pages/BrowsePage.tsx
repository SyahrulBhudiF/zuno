import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SpinnerSteps } from "@/components/motion/loader";
import { ArrowLeftIcon, DownloadIcon } from "@/ui/icons";
import type {
  Album,
  Artist,
  BrowsePage as BrowsePageData,
  BrowseSurface,
  BrowseTarget,
  Playlist,
  Track,
} from "../../datasource/types";
import type { LibraryController } from "../../player/LibraryController";
import type { PlayerControllerActions } from "../../player/playerStore";
import { logInternalError } from "../../internal/logging";
import { removeAllDownloads, useOfflineState } from "../../player/offlineStore";
import { AlbumCard } from "../components/AlbumCard";
import { TrackArtwork } from "../components/TrackArtwork";
import { TrackRow } from "../components/TrackRow";
import { useTrackContextMenu } from "../components/TrackContextMenu";
import { useNowPlaying } from "../hooks/useNowPlaying";

/**
 * "downloads" is not a YouTube feed — it reads from the offline store on this machine. It
 * lives here anyway because from the user's side it is the same question ("what can I play?"),
 * and it is the one tab that still works with no connection at all.
 */
export type BrowseTab = BrowseSurface | "downloads";

const SURFACES: Array<{ value: BrowseTab; label: string }> = [
  { value: "explore", label: "Explore" },
  { value: "charts", label: "Charts" },
  { value: "moods", label: "Moods & genres" },
  { value: "podcasts", label: "Podcasts" },
  { value: "downloads", label: "Downloads" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** Horizontal shelves: a browse feed is a list of rows, and stacking them all vertically buries everything below the first. */
const SHELF_ROW =
  "flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function ArtistTile({ artist, onOpen }: { artist: Artist; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-32 shrink-0 flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <TrackArtwork
        className="size-24 rounded-full"
        artworkUrl={artist.artworkUrl}
        iconSize={28}
        variant="artist"
      />
      <span className="line-clamp-2 text-xs font-medium text-foreground">{artist.name}</span>
    </button>
  );
}

function PlaylistTile({ playlist, onOpen }: { playlist: Playlist; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-36 shrink-0 flex-col gap-2 rounded-xl p-2 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <TrackArtwork
        className="size-32 rounded-lg"
        artworkUrl={playlist.artworkUrl}
        iconSize={28}
        variant="playlist"
      />
      <span className="line-clamp-2 text-xs font-medium text-foreground">{playlist.title}</span>
      <span className="truncate text-[11px] text-muted-foreground">{playlist.owner}</span>
    </button>
  );
}

/**
 * YouTube Music's browse feeds — explore, charts, moods and podcasts.
 *
 * All four are the same shape (titled shelves of mixed content), so they share one page with
 * a surface switcher rather than becoming four near-identical files. Shelves render by what
 * they actually contain, because a feed row mixes albums, playlists and artists freely and
 * which appears where changes without notice.
 */
export function BrowsePage({
  initialTab = "explore",
  playerController,
  libraryController,
  onOpenAlbum,
  onOpenArtist,
  onOpenPlaylist,
}: {
  /** Which tab to open on. Downloads is reached this way from the home page. */
  initialTab?: BrowseTab;
  playerController: PlayerControllerActions;
  libraryController: LibraryController;
  onOpenAlbum: (album: Album) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
}) {
  const [surface, setSurface] = useState<BrowseTab>(initialTab);
  /*
   * Chips drill into further feeds. Kept as a stack inside this page rather than as new tabs:
   * a mood is a filter of the feed you are already in, not a separate destination, and going
   * back should return you to the shelf you tapped from.
   */
  const [drillDown, setDrillDown] = useState<Array<{ browseId: string; title: string }>>([]);
  const isDownloads = surface === "downloads" && drillDown.length === 0;
  const target: BrowseTarget = drillDown[drillDown.length - 1]
    ?? (surface === "downloads" ? "explore" : surface);
  const offline = useOfflineState();
  const downloads = useMemo(
    () => Object.values(offline.entries).sort((left, right) => right.downloadedAt - left.downloadedAt),
    [offline.entries],
  );
  /*
   * Songs still arriving, listed above the finished ones. Without these the tab looks empty
   * for as long as a download takes, which is exactly when you go looking at it.
   */
  const inFlight = useMemo(() => {
    const ids = [
      ...(offline.downloadingId ? [offline.downloadingId] : []),
      ...offline.queued,
    ];
    return ids
      .map((id) => offline.pending[id])
      .filter((track): track is NonNullable<typeof track> => Boolean(track));
  }, [offline.downloadingId, offline.pending, offline.queued]);
  const [page, setPage] = useState<BrowsePageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
  const { currentTrackId, isPlaying } = useNowPlaying();
  const { openTrackMenu, openPlaylistPicker } = useTrackContextMenu();

  useEffect(() => {
    // Downloads never hits the network, so the feed fetch is skipped entirely.
    if (isDownloads) return;

    let cancelled = false;
    setPage(null);
    setError(null);

    libraryController
      .getBrowsePage(target)
      .then((loaded) => {
        if (!cancelled) setPage(loaded);
      })
      .catch((cause: unknown) => {
        logInternalError("BrowsePage.load failed", cause, { surface });
        if (!cancelled) setError("Could not load this feed.");
      });

    return () => {
      cancelled = true;
    };
  }, [isDownloads, libraryController, target]);

  const playShelfTrack = (shelfTracks: Track[], track: Track) => {
    void playerController.playTrackById(track.id, shelfTracks);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {drillDown.length > 0 && (
            <button
              type="button"
              onClick={() => setDrillDown((stack) => stack.slice(0, -1))}
              aria-label="Back"
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeftIcon size={18} aria-hidden="true" />
            </button>
          )}
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-foreground">
            {drillDown[drillDown.length - 1]?.title ?? (isDownloads ? "Downloads" : "Browse")}
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Browse feed">
          {SURFACES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={surface === item.value && drillDown.length === 0}
              onClick={() => {
                setSurface(item.value);
                setDrillDown([]);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                surface === item.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {isDownloads ? (
        downloads.length === 0 && inFlight.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-card text-muted-foreground">
              <DownloadIcon size={24} aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-foreground">Nothing downloaded yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Use the download button on any song to keep it on this machine. Downloaded songs
              play without a connection.
            </p>
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {downloads.length} {downloads.length === 1 ? "song" : "songs"} ·{" "}
                {formatSize(offline.usedBytes)}
                {inFlight.length > 0 ? ` · ${inFlight.length} in progress` : ""}
                {offline.downloadingId
                  ? offline.progress !== null
                    ? ` · downloading ${offline.progress}%`
                    : " · downloading"
                  : ""}

              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirmRemoveAll) {
                    void removeAllDownloads();
                    setConfirmRemoveAll(false);
                    return;
                  }
                  setConfirmRemoveAll(true);
                }}
                onBlur={() => setConfirmRemoveAll(false)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  confirmRemoveAll
                    ? "bg-destructive/10 text-destructive"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {confirmRemoveAll ? "Click again to remove all" : "Remove all"}
              </button>
            </div>

            {inFlight.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {inFlight.map((track, index) => {
                  const isActive = offline.downloadingId === track.id;
                  return (
                    <TrackRow
                      key={`pending:${track.id}`}
                      track={track}
                      index={index}
                      isCurrent={false}
                      isPlaying={false}
                      onSelect={() => playShelfTrack([track], track)}
                      onContextMenu={(event) => openTrackMenu(event, track)}
                      showDownload

                      showRating
                      className="opacity-70"
                      trailing={
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {isActive
                            ? offline.progress !== null
                              ? `${offline.progress}%`
                              : "Downloading"
                            : "Queued"}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              {downloads.map((entry, index) => (
                <TrackRow
                  key={entry.track.id}
                  track={entry.track}
                  index={index}
                  isCurrent={currentTrackId === entry.track.id}
                  isPlaying={isPlaying && currentTrackId === entry.track.id}
                  onSelect={() =>
                    playShelfTrack(downloads.map((item) => item.track), entry.track)
                  }
                  onContextMenu={(event) => openTrackMenu(event, entry.track)}
                  onQuickAdd={() => openPlaylistPicker(entry.track)}
                  onQuickAddToQueue={() => playerController.addToQueue(entry.track)}
                  showDownload

                  showRating
                  trailing={
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatSize(entry.byteLength)}
                    </span>
                  }
                />
              ))}
            </div>
          </section>
        )
      ) : error ? (
        <p className="px-2 py-10 text-center text-sm text-muted-foreground">{error}</p>
      ) : page === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <SpinnerSteps size={18} color="currentColor" />
          Loading {SURFACES.find((item) => item.value === surface)?.label}...
        </div>
      ) : page.shelves.length === 0 ? (
        <p className="px-2 py-10 text-center text-sm text-muted-foreground">
          YouTube Music returned nothing for this feed.
        </p>
      ) : (
        page.shelves.map((shelf) => (
          <section key={shelf.title} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">{shelf.title}</h2>

            {/* Songs read better as a list than as tiles, so they get rows even inside a feed
                that is otherwise all artwork. */}
            {shelf.tracks.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {shelf.tracks.map((track, index) => (
                  <TrackRow
                    key={`${track.id}:${index}`}
                    track={track}
                    index={index}
                    isCurrent={currentTrackId === track.id}
                    isPlaying={isPlaying && currentTrackId === track.id}
                    onSelect={() => playShelfTrack(shelf.tracks, track)}
                    onContextMenu={(event) => openTrackMenu(event, track)}
                    onQuickAdd={() => openPlaylistPicker(track)}
                    onQuickAddToQueue={() => playerController.addToQueue(track)}
                    showDownload

                    showRating
                  />
                ))}
              </div>
            )}

            {/* Chips lead to other feeds, so they read as filters rather than as content. */}
            {shelf.links.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {shelf.links.map((link) => (
                  <button
                    key={link.browseId}
                    type="button"
                    onClick={() =>
                      setDrillDown((stack) => [...stack, { browseId: link.browseId, title: link.title }])
                    }
                    className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link.title}
                  </button>
                ))}
              </div>
            )}

            {shelf.albums.length > 0 && (
              <div className={SHELF_ROW}>
                {shelf.albums.map((album) => (
                  <div key={album.id} className="w-36 shrink-0">
                    <AlbumCard
                      artworkUrl={album.artworkUrl}
                      title={album.title}
                      subtitle={album.artist}
                      onClick={() => onOpenAlbum(album)}
                    />
                  </div>
                ))}
              </div>
            )}

            {shelf.playlists.length > 0 && (
              <div className={SHELF_ROW}>
                {shelf.playlists.map((playlist) => (
                  <PlaylistTile
                    key={playlist.id}
                    playlist={playlist}
                    onOpen={() => onOpenPlaylist(playlist)}
                  />
                ))}
              </div>
            )}

            {shelf.artists.length > 0 && (
              <div className={SHELF_ROW}>
                {shelf.artists.map((artist) => (
                  <ArtistTile
                    key={artist.id}
                    artist={artist}
                    onOpen={() => onOpenArtist(artist)}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
