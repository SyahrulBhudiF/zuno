import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/motion/loader";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, SearchIcon } from "@/ui/icons";
import type { Playlist, Track } from "../../datasource/types";
import type { LibraryController } from "../../player/LibraryController";
import type { PlayerControllerActions } from "../../player/playerStore";
import { markPlaylistPlayed } from "../../player/recentPlaylists";
import { shuffleTracks } from "../../player/shuffleTracks";
import { useTrackContextMenu } from "../components/TrackContextMenu";
import { isLocalPlaylist, reorderLocalPlaylistTracks } from "../../player/localPlaylists";
import { usePlaylistContextMenu } from "../components/PlaylistContextMenu";
import { formatCollectionMeta, MediaHeader } from "../components/MediaHeader";
import { isLikedSongsId, likedSongsCover } from "../likedSongsArtwork";
import { TrackRow } from "../components/TrackRow";
import { useNowPlaying } from "../hooks/useNowPlaying";
import { useKeyboardShortcuts } from "../settings/keyboardShortcuts";
import { shouldStartPageSearch } from "./pageSearchKeyboard";

/*
 * Collapsed search affordance that widens on hover/focus or while it holds a query —
 * the behaviour the original .playlistSearch width transition provided.
 */
const SEARCH_FIELD =
  "group/search flex min-h-8 items-center gap-1.5 overflow-hidden rounded-full bg-white/[0.04] px-2.5 " +
  "text-muted-foreground transition-[width,background-color] duration-200 cursor-text " +
  "hover:bg-white/[0.08] focus-within:bg-white/[0.08] focus-within:text-foreground " +
  "[&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:text-sm " +
  "[&_input]:text-foreground [&_input]:outline-none [&_input]:placeholder:text-muted-foreground";
const SEARCH_FIELD_COLLAPSED = "w-9 hover:w-56 focus-within:w-56";

interface PlaylistViewProps {
  playlist?: Playlist;
  playerController: PlayerControllerActions;
  libraryController: LibraryController;
}

type PlaylistSort = "dateAdded" | "name" | "album";
type SortDirection = "asc" | "desc";

const playlistSorts: Array<{ value: PlaylistSort; label: string }> = [
  { value: "name", label: "Name" },
  { value: "album", label: "Album" },
  { value: "dateAdded", label: "Date Added" },
];

function compareText(left: string | undefined, right: string | undefined): number {
  return (left || "\uffff").localeCompare(right || "\uffff", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getDirectionLabel(sort: PlaylistSort, direction: SortDirection): string {
  if (sort === "dateAdded") return direction === "desc" ? "Newest" : "Oldest";
  return direction === "asc" ? "Asc" : "Desc";
}

function SortDirectionIcon({ direction }: { direction: SortDirection }) {
  return direction === "asc"
    ? <ArrowUpIcon size={13} strokeWidth={2.2} aria-hidden="true" />
    : <ArrowDownIcon size={13} strokeWidth={2.2} aria-hidden="true" />;
}

function getTrackRenderKey(track: Track, index: number): string {
  return track.playlistItemId ?? `${track.id}:${index}`;
}

function getUniqueNewTracks(current: Track[], next: Track[]): Track[] {
  const existingIds = new Set(current.map((track) => track.id));
  return next.filter((track) => {
    if (existingIds.has(track.id)) return false;
    existingIds.add(track.id);
    return true;
  });
}

function PlaylistLoadingSpinner({ label }: { label: string }) {
  return (
    <div className="grid place-items-center px-2 py-16 text-muted-foreground" role="status" aria-live="polite" aria-label={label}>
      <Loader variant="spinner" size={18} />
    </div>
  );
}

export function PlaylistView({ playlist, playerController, libraryController }: PlaylistViewProps) {
  const { openTrackMenu } = useTrackContextMenu();
  const { openPlaylistMenu } = usePlaylistContextMenu();
  const keyboardShortcuts = useKeyboardShortcuts();
  /*
   * Only the identity of the current track and the transport status are needed here, and
   * both change at most once per track. Playback *position* deliberately never enters this
   * component — it lives in SeekBar's local state, so a long playlist is not re-rendered on
   * every tick.
   */
  const { currentTrackId, isPlaying, isLoading: isPlayerLoading } = useNowPlaying();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreTracks, setHasMoreTracks] = useState(false);
  const [nextPageKey, setNextPageKey] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [sort, setSort] = useState<PlaylistSort>("dateAdded");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState("");
  const [dropTargetIndex, setDropTargetIndex] = useState<{ localPath: string; insertAfter: boolean } | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const playlistSearchInputRef = useRef<HTMLInputElement | null>(null);
  const playlistIdRef = useRef<string | undefined>(undefined);
  const isLoadingMoreRef = useRef(false);
  const tracksRef = useRef<Track[]>([]);
  const pointerDragRef = useRef<{
    pointerId: number;
    localPath: string;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const dropTargetRef = useRef<{ localPath: string; insertAfter: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  playlistIdRef.current = playlist?.id;
  isLoadingMoreRef.current = isLoadingMore;
  tracksRef.current = tracks;

  const isLocalPlaylistView = playlist ? isLocalPlaylist(playlist) : false;

  useEffect(() => {
    if (!playlist) return;
    let active = true;
    setSort("dateAdded");
    setSortDirection("desc");
    setPlaylistSearchQuery("");
    setTracks([]);
    setIsLoading(true);
    setIsLoadingMore(false);
    setHasMoreTracks(false);
    setNextPageKey(undefined);
    setError(null);
    setLoadMoreError(null);
    let showedPage = false;
    const showPage = (page: { tracks: Track[]; hasMore: boolean; nextPageKey?: string }) => {
      if (!active) return;
      showedPage = true;
      setTracks(page.tracks);
      setHasMoreTracks(page.hasMore);
      setNextPageKey(page.nextPageKey);
      setIsLoading(false);
    };
    void libraryController.getPlaylistTrackPage(playlist, undefined, (page) => {
      if (page.tracks.length > 0) showPage(page);
    })
      .then((page) => {
        showPage(page);
      })
      .catch(() => {
        if (active && !showedPage) setError("Unable to load this playlist.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [playlist, libraryController]);

  const loadMoreTracks = useCallback(async () => {
    if (!playlist || !hasMoreTracks || !nextPageKey || isLoading || isLoadingMoreRef.current) return;
    const loadingPlaylistId = playlist.id;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const page = await libraryController.getPlaylistTrackPage(playlist, nextPageKey);
      if (playlistIdRef.current !== loadingPlaylistId) return;
      const uniqueNewTracks = getUniqueNewTracks(tracksRef.current, page.tracks);
      if (uniqueNewTracks.length > 0) {
        setTracks((current) => [...current, ...uniqueNewTracks]);
      }
      setHasMoreTracks(page.hasMore);
      setNextPageKey(page.nextPageKey);
    } catch {
      if (playlistIdRef.current === loadingPlaylistId) {
        setLoadMoreError("Could not load more songs.");
      }
    } finally {
      if (playlistIdRef.current === loadingPlaylistId) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [hasMoreTracks, isLoading, libraryController, nextPageKey, playlist]);

  useEffect(() => {
    if (!hasMoreTracks) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const scrollRoot = sentinel.closest("[data-page-scroll-root]");

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMoreTracks();
      }
    }, {
      root: scrollRoot instanceof Element ? scrollRoot : null,
      rootMargin: "700px 0px",
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreTracks, loadMoreTracks, tracks.length]);

  useEffect(() => {
    if (!playlist || isLoading || error || tracks.length === 0) return;

    const handlePageSearchKeyDown = (event: KeyboardEvent) => {
      if (!shouldStartPageSearch(event, keyboardShortcuts)) return;
      event.preventDefault();
      setPlaylistSearchQuery((current) => `${current}${event.key}`);
      window.requestAnimationFrame(() => playlistSearchInputRef.current?.focus());
    };

    window.addEventListener("keydown", handlePageSearchKeyDown);
    return () => window.removeEventListener("keydown", handlePageSearchKeyDown);
  }, [error, isLoading, keyboardShortcuts, playlist, tracks.length]);

  const sortedTracks = useMemo(() => {
    if (sort === "dateAdded") {
      return sortDirection === "desc" ? tracks : [...tracks].reverse();
    }
    const sorted = [...tracks].sort((left, right) => {
      if (sort === "name") {
        return compareText(left.title, right.title)
          || compareText(left.artist, right.artist)
          || compareText(left.album, right.album);
      }
      return compareText(left.album, right.album)
        || compareText(left.title, right.title)
        || compareText(left.artist, right.artist);
    });
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [sort, sortDirection, tracks]);

  const sortedTracksRef = useRef(sortedTracks);
  sortedTracksRef.current = sortedTracks;

  const visibleTracks = useMemo(() => {
    const query = playlistSearchQuery.trim().toLocaleLowerCase();
    if (!query) return sortedTracks;
    return sortedTracks.filter((track) => [
      track.title,
      track.artist,
      track.album,
      ...(track.artists?.map((artist) => artist.name) ?? []),
    ].some((value) => value?.toLocaleLowerCase().includes(query)));
  }, [playlistSearchQuery, sortedTracks]);

  // Drag to reorder for local playlists
  useEffect(() => {
    if (!isLocalPlaylistView) return;

    const handlePointerMove = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (!drag.isDragging) {
        const distance = Math.abs(event.clientY - drag.startY);
        if (distance < 6) return;
        drag.isDragging = true;
      }

      event.preventDefault();
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-playlist-track-path]");
      if (!target) {
        setDropTargetIndex(null);
        dropTargetRef.current = null;
        return;
      }

      const bounds = target.getBoundingClientRect();
      const nextTarget = {
        localPath: target.dataset.playlistTrackPath ?? "",
        insertAfter: event.clientY >= bounds.top + bounds.height / 2,
      };
      dropTargetRef.current = nextTarget;
      setDropTargetIndex(nextTarget);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (drag.isDragging && dropTargetRef.current && playlist) {
        const fromPath = drag.localPath;
        const toPath = dropTargetRef.current.localPath;
        if (!fromPath || !toPath) {
          pointerDragRef.current = null;
          setDropTargetIndex(null);
          return;
        }

        const sorted = sortedTracksRef.current;
        const fromIndex = sorted.findIndex((t) => (t.localPath ?? t.id) === fromPath);
        const toIndex = sorted.findIndex((t) => (t.localPath ?? t.id) === toPath);
        if (fromIndex < 0 || toIndex < 0) return;

        const clampedToIndex = dropTargetRef.current.insertAfter
          ? Math.min(toIndex + 1, sorted.length)
          : toIndex;
        const insertIndex = fromIndex < clampedToIndex
          ? clampedToIndex - 1
          : clampedToIndex;

        if (fromIndex !== insertIndex) {
          reorderLocalPlaylistTracks(playlist.id, fromIndex, clampedToIndex);
          setTracks((current) => {
            const next = [...current];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(insertIndex, 0, moved);
            return next;
          });
        }
      }

      if (drag.isDragging) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      dropTargetRef.current = null;
      pointerDragRef.current = null;
      setDropTargetIndex(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isLocalPlaylistView, playlist]);

  if (!playlist) return null;

  const playPlaylistTrack = async (track: Track) => {
    const started = await playerController.playTrackById(track.id, visibleTracks);
    if (started) markPlaylistPlayed(playlist.id);
  };

  const isLikedSongs = isLikedSongsId(playlist.id, playlist.kind);

  /*
   * O(1) membership test instead of scanning the track array on every render — these lists
   * run to several hundred rows.
   */
  const trackIds = useMemo(() => new Set(tracks.map((track) => track.id)), [tracks]);
  const isCurrentCollection = currentTrackId !== null && trackIds.has(currentTrackId);

  /*
   * Resumes rather than restarts when this collection is already loaded: pressing Play on
   * the playlist you just paused should pick up where it left off, not jump to track one.
   */
  const togglePlayCollection = async () => {
    if (isCurrentCollection) {
      playerController.togglePlayPause();
      return;
    }
    await playInOrder();
  };

  const playInOrder = async () => {
    const firstTrack = tracks[0];
    if (!firstTrack) return;

    const started = await playerController.playTrackById(firstTrack.id, tracks);
    if (started) markPlaylistPlayed(playlist.id);
  };

  const playShuffled = async () => {
    const shuffledTracks = shuffleTracks(tracks);
    const firstTrack = shuffledTracks[0];
    if (!firstTrack) return;

    const started = await playerController.playTrackById(firstTrack.id, shuffledTracks);
    if (started) markPlaylistPlayed(playlist.id);
  };

  const removeTrackFromList = (removedTrack: Track) => {
    setTracks((current) => current.filter((item) =>
      playlist.kind === "liked-songs" || playlist.id === "LM"
        ? item.id !== removedTrack.id
        : removedTrack.localPath
          ? item.localPath !== removedTrack.localPath
          : item.playlistItemId !== removedTrack.playlistItemId
    ));
  };

  const selectSort = (nextSort: PlaylistSort) => {
    if (nextSort === sort) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSort(nextSort);
    setSortDirection(nextSort === "dateAdded" ? "desc" : "asc");
  };

  const handlePlaylistSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Backspace" || playlistSearchQuery) return;
    event.preventDefault();
    event.currentTarget.blur();
  };

  const handlePointerDown = (event: React.PointerEvent, track: Track) => {
    if (!isLocalPlaylistView || event.button !== 0) return;
    pointerDragRef.current = {
      pointerId: event.pointerId,
      localPath: track.localPath ?? track.id,
      startY: event.clientY,
      isDragging: false,
    };
  };

  return (
    <div className="flex flex-col gap-8">
      <div onContextMenu={(event) => openPlaylistMenu(event, playlist)}>
        <MediaHeader
          eyebrow="Playlist"
          title={playlist.title}
          subtitle={playlist.owner}
          meta={formatCollectionMeta(tracks, hasMoreTracks)}
          artworkUrl={playlist.artworkUrl}
          artworkVariant="playlist"
          artworkSlot={isLikedSongs ? (
            <img
              className="size-44 shrink-0 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
              src={likedSongsCover}
              alt=""
            />
          ) : undefined}
          actionsDisabled={isLoading || Boolean(error) || tracks.length === 0}
          isPlaying={isCurrentCollection && isPlaying}
          isLoading={isCurrentCollection && isPlayerLoading}
          onPlay={() => void togglePlayCollection()}
          onShuffle={() => void playShuffled()}
        />
      </div>
      {isLoading && <PlaylistLoadingSpinner label="Loading songs" />}
      {error && <p className="px-2 py-10 text-center text-sm text-muted-foreground">{error}</p>}
      {!isLoading && !error && !hasMoreTracks && tracks.length === 0 && (
        <p className="px-2 py-10 text-center text-sm text-muted-foreground">This playlist is empty.</p>
      )}
      {!isLoading && !error && (tracks.length > 0 || hasMoreTracks) && (
        <>
          <div
            className="flex flex-wrap items-center gap-1.5 self-start [&>button]:flex [&>button]:min-h-8 [&>button]:min-w-0 [&>button]:items-center [&>button]:justify-center [&>button]:gap-1.5 [&>button]:rounded-full [&>button]:bg-white/[0.04] [&>button]:px-3 [&>button]:text-sm [&>button]:font-medium [&>button]:text-muted-foreground [&>button]:transition-colors hover:[&>button]:bg-white/[0.08] hover:[&>button]:text-foreground focus-visible:[&>button]:outline-none focus-visible:[&>button]:ring-2 focus-visible:[&>button]:ring-ring"
            role="group"
            aria-label="Playlist song tools"
          >
            {playlistSorts.map((item) => (
              <button
                key={item.value}
                type="button"
                className={sort === item.value ? "bg-primary/15 text-foreground" : ""}
                aria-pressed={sort === item.value}
                aria-label={`Sort by ${item.label} ${
                  sort === item.value ? getDirectionLabel(item.value, sortDirection) : ""
                }`.trim()}
                onClick={() => selectSort(item.value)}
              >
                <span>{item.label}</span>
                {sort === item.value && (
                  <span
                    className={`${"flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"} ${
                      item.value === "dateAdded" ? "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <span className="shrink-0">
                      <SortDirectionIcon direction={sortDirection} />
                    </span>
                    {item.value === "dateAdded" && (
                      <span className="sr-only">
                        {getDirectionLabel(item.value, sortDirection)}
                      </span>
                    )}
                  </span>
                )}
              </button>
            ))}
            <div
              className={cn(SEARCH_FIELD, playlistSearchQuery ? "w-56" : SEARCH_FIELD_COLLAPSED)}
              role="search"
              onClick={() => playlistSearchInputRef.current?.focus()}
            >
              <span className="shrink-0">
                <SearchIcon size={16} aria-hidden="true" />
              </span>
              <input
                ref={playlistSearchInputRef}
                type="text"
                value={playlistSearchQuery}
                aria-label="Search songs in playlist"
                placeholder="Search playlist"
                onChange={(event) => setPlaylistSearchQuery(event.target.value)}
                onKeyDown={handlePlaylistSearchKeyDown}
              />
              {playlistSearchQuery && (
                <button
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="button"
                  aria-label="Clear playlist search"
                  onClick={() => setPlaylistSearchQuery("")}
                >
                  <CloseIcon size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          {visibleTracks.length === 0 && playlistSearchQuery.trim() ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">No songs match this search.</p>
          ) : (
          <div className="flex flex-col gap-0.5">
            {visibleTracks.map((track, index) => {
              const trackPath = track.localPath ?? track.id;
              /*
               * Match on the *player's* current track rather than a row index: the same
               * track can appear more than once, and the queue can be reordered or shuffled
               * out from under this list.
               */
              const isCurrent = currentTrackId !== null && track.id === currentTrackId;
              const isCurrentPlaying = isCurrent && isPlaying;
              const isDragged = pointerDragRef.current?.localPath === trackPath && pointerDragRef.current.isDragging;
              const isDropBefore = dropTargetIndex
                && dropTargetIndex.localPath === trackPath
                && !dropTargetIndex.insertAfter;
              const isDropAfter = dropTargetIndex
                && dropTargetIndex.localPath === trackPath
                && dropTargetIndex.insertAfter;
              return (
                <TrackRow
                  key={getTrackRenderKey(track, index)}
                  track={track}
                  index={index}
                  isCurrent={isCurrent}
                  isPlaying={isCurrentPlaying}
                  data-playlist-track-path={trackPath}
                  className={cn(isDragged && "opacity-40")}
                  onSelect={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    void playPlaylistTrack(track);
                  }}
                  onContextMenu={(event) => openTrackMenu(event, track, {
                    playlist,
                    onRemove: removeTrackFromList,
                  })}
                  onPointerDown={(event) => handlePointerDown(event, track)}
                >
                  {/* Reorder drop indicators, drawn inside the row so they track it. */}
                  {isDropBefore && (
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-primary" />
                  )}
                  {isDropAfter && (
                    <span className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                  )}
                </TrackRow>
              );
            })}
          </div>
          )}
          <div ref={loadMoreRef} className="px-2 py-4 text-center text-sm text-muted-foreground" aria-live="polite">
            {isLoadingMore ? (
              <PlaylistLoadingSpinner label="Loading more songs" />
            ) : loadMoreError ? (
              loadMoreError
            ) : hasMoreTracks ? (
              ""
            ) : (
              ""
            )}
          </div>
        </>
      )}
    </div>
  );
}
