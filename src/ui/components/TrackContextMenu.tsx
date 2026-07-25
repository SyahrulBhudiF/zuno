import {
  createContext,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckIcon, CloseIcon, HeartActiveIcon, HeartIcon, LinkIcon, ListIcon, PlaylistAddIcon, PlaylistIcon, SearchIcon, SkipNextIcon, TrashIcon } from "@/ui/icons";
import type { Playlist, Track } from "../../datasource/types";
import type { LibraryController } from "../../player/LibraryController";
import { logInternalError } from "../../internal/logging";
import {
  playerController,
  useLibraryState,
  usePlayerState,
} from "../../player/playerStore";
import { TrackArtwork } from "./TrackArtwork";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/motion/loader";

const PICKER_ROW =
  "flex w-full items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
import { isLocalPlaylist } from "../../player/localPlaylists";
import { ArtistLinks } from "./ArtistLinks";

interface MenuPosition {
  x: number;
  y: number;
}

interface TrackContextMenuValue {
  openTrackMenu: (
    event: ReactMouseEvent,
    track: Track,
    context?: {
      playlist?: Playlist;
      onRemove?: (track: Track) => void;
    },
  ) => void;
  toggleTrackLike: (track: Track) => Promise<void>;
}

interface TrackContextMenuProviderProps {
  children: ReactNode;
  libraryController: LibraryController;
}

const TrackContextMenuContext = createContext<TrackContextMenuValue | null>(null);

export function useTrackContextMenu(): TrackContextMenuValue {
  const value = useContext(TrackContextMenuContext);
  if (!value) {
    throw new Error("useTrackContextMenu must be used within TrackContextMenuProvider.");
  }
  return value;
}

export function TrackContextMenuProvider({
  children,
  libraryController,
}: TrackContextMenuProviderProps) {
  const libraryState = useLibraryState();
  const playerState = usePlayerState();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const playlistRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const toastTimerRef = useRef<number | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [menuContext, setMenuContext] = useState<{
    playlist?: Playlist;
    onRemove?: (track: Track) => void;
  } | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPlaylistIndex, setSelectedPlaylistIndex] = useState<number | null>(null);
  const [addingPlaylistId, setAddingPlaylistId] = useState<string | null>(null);
  const [isRemovingTrack, setIsRemovingTrack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const playlists = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const items = (libraryState.library?.playlists ?? []).filter(
      (playlist) => playlist.isEditable !== false && (track?.source !== "local" || !isLocalPlaylist(playlist)),
    );
    if (!normalizedQuery) return items;
    return items.filter((playlist) =>
      playlist.title.toLocaleLowerCase().includes(normalizedQuery)
    );
  }, [libraryState.library?.playlists, query, track?.source]);

  useEffect(() => {
    if (!menuPosition) return;
    const closeMenu = () => setMenuPosition(null);
    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("blur", closeMenu);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("blur", closeMenu);
    };
  }, [menuPosition]);

  useLayoutEffect(() => {
    if (!menuPosition) return;

    const keepMenuInViewport = () => {
      const menu = menuRef.current;
      if (!menu) return;

      const viewportMargin = 8;
      const bounds = menu.getBoundingClientRect();
      const x = Math.max(
        viewportMargin,
        Math.min(menuPosition.x, window.innerWidth - bounds.width - viewportMargin),
      );
      const y = Math.max(
        viewportMargin,
        Math.min(menuPosition.y, window.innerHeight - bounds.height - viewportMargin),
      );

      if (x !== menuPosition.x || y !== menuPosition.y) {
        setMenuPosition({ x, y });
      }
    };

    keepMenuInViewport();
    window.addEventListener("resize", keepMenuInViewport);
    return () => window.removeEventListener("resize", keepMenuInViewport);
  }, [menuContext, menuPosition, track]);

  useEffect(() => {
    if (isPickerOpen) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!isPickerOpen && !menuPosition)) return;
      event.preventDefault();
      setMenuPosition(null);
      if (!addingPlaylistId) setIsPickerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addingPlaylistId, isPickerOpen, menuPosition]);

  useEffect(() => {
    if (selectedPlaylistIndex === null) return;
    playlistRefs.current[selectedPlaylistIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [selectedPlaylistIndex]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const ctrlOnly = event.ctrlKey
        && !event.altKey
        && !event.metaKey
        && !event.shiftKey;
      if (!ctrlOnly || event.code !== "KeyS") return;

      event.preventDefault();
      if (!playerState.currentTrack || addingPlaylistId) return;

      setTrack(playerState.currentTrack);
      setMenuPosition(null);
      setError(null);
      setQuery("");
      setSelectedPlaylistIndex(null);
      setIsPickerOpen(true);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [addingPlaylistId, playerState.currentTrack]);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  const openTrackMenu = (
    event: ReactMouseEvent,
    selectedTrack: Track,
    context?: { playlist?: Playlist; onRemove?: (track: Track) => void },
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setTrack(selectedTrack);
    setMenuContext(context ?? null);
    setIsPickerOpen(false);
    setError(null);
    setQuery("");
    setSelectedPlaylistIndex(null);
    setMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const showToast = (message: string, duration = 3000) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
  };

  const showPersistentToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const addToQueue = () => {
    if (!track) return;
    playerController.addToQueue(track);
    setMenuPosition(null);
    showToast(`Added "${track.title}" to queue`);
  };

  const playNext = () => {
    if (!track) return;
    playerController.playNext(track);
    setMenuPosition(null);
    showToast(`"${track.title}" will play next`);
  };

  const copyLink = async () => {
    if (!track) return;
    const selectedTrack = track;
    setMenuPosition(null);
    try {
      await navigator.clipboard.writeText(
        `https://music.youtube.com/watch?v=${encodeURIComponent(selectedTrack.id)}`,
      );
      showToast("Link copied");
    } catch {
      showToast("Unable to copy the link.", 4000);
    }
  };

  const openPicker = () => {
    setMenuPosition(null);
    setError(null);
    setQuery("");
    setSelectedPlaylistIndex(null);
    setIsPickerOpen(true);
  };

  const removeFromPlaylist = async () => {
    if (!track || !menuContext?.playlist || addingPlaylistId || isRemovingTrack) return;

    const selectedTrack = track;
    const playlist = menuContext.playlist;

    setIsRemovingTrack(true);
    setError(null);
    setMenuPosition(null);
    showPersistentToast("Removing...");

    try {
      if (playlist.kind === "liked-songs" || playlist.id === "LM") {
        await libraryController.setTrackLiked(selectedTrack, false);
      } else {
        await libraryController.removeTrackFromPlaylist(selectedTrack, playlist);
      }
      menuContext.onRemove?.(selectedTrack);
      showToast(
        playlist.kind === "liked-songs" || playlist.id === "LM"
          ? "Removed from Liked Songs"
          : `Removed from ${playlist.title}`,
      );
    } catch (removeError) {
      logInternalError("TrackContextMenu.removeFromPlaylist failed", removeError, {
        trackId: selectedTrack.id,
        playlistId: playlist.id,
        playlistTitle: playlist.title,
      });
      showToast(
        removeError instanceof Error ? removeError.message : "Unable to remove this song.",
        4000,
      );
    } finally {
      setIsRemovingTrack(false);
    }
  };

  const handlePickerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (addingPlaylistId || playlists.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setSelectedPlaylistIndex((current) => {
        if (current === null) return direction === 1 ? 0 : playlists.length - 1;
        return (current + direction + playlists.length) % playlists.length;
      });
      return;
    }

    if (event.key === "Enter" && selectedPlaylistIndex !== null) {
      event.preventDefault();
      const playlist = playlists[selectedPlaylistIndex];
      if (playlist) void addToPlaylist(playlist);
    }
  };

  const addToPlaylist = async (playlist: Playlist) => {
    if (!track || addingPlaylistId) return;
    const selectedTrack = track;
    setAddingPlaylistId(playlist.id);
    setError(null);
    setIsPickerOpen(false);
    showPersistentToast("Adding...");
    try {
      const result = await libraryController.addTrackToPlaylist(selectedTrack, playlist);
      showToast(
        result === "already-present"
          ? "Already in playlist"
          : `Added to ${playlist.title}`,
      );
    } catch (addError) {
      showToast(
        addError instanceof Error ? addError.message : "Unable to add this song.",
        4000,
      );
    } finally {
      setAddingPlaylistId(null);
    }
  };

  const toggleTrackLike = async (selectedTrack: Track) => {
    if (selectedTrack.source === "local") return;
    if (libraryState.status === "signed-out" || !libraryState.library) {
      showToast("Sign in to like");
      return;
    }
    if (libraryState.pendingLikeTrackIds.has(selectedTrack.id)) return;

    const shouldLike = !libraryController.isTrackLiked(selectedTrack.id);
    showPersistentToast(shouldLike ? "Liking..." : "Removing like...");
    try {
      await libraryController.setTrackLiked(selectedTrack, shouldLike);
      showToast(shouldLike ? "Added to Liked Songs" : "Removed from Liked Songs");
    } catch (likeError) {
      showToast(
        likeError instanceof Error ? likeError.message : "Unable to update this like.",
        4000,
      );
    }
  };

  const selectedTrackIsLiked = track && track.source !== "local"
    ? libraryState.library?.likedSongs.some((item) => item.id === track.id) ?? false
    : false;
  const isLikeMutationPending = track && track.source !== "local"
    ? libraryState.pendingLikeTrackIds.has(track.id)
    : false;
  const canLikeSelectedTrack = track?.source !== "local";
  const canCopySelectedTrackLink = track?.source !== "local";
  const canRemoveSelectedTrackFromPlaylist = Boolean(
    menuContext?.playlist
      && menuContext.playlist.isEditable !== false
      && menuContext.playlist.kind !== "liked-songs"
      && menuContext.playlist.id !== "LM"
      && !isLocalPlaylist(menuContext.playlist),
  );

  return (
    <TrackContextMenuContext.Provider value={{ openTrackMenu, toggleTrackLike }}>
      {children}

      {menuPosition && track && (
        <div
          ref={menuRef}
          className="fixed z-50 flex min-w-56 flex-col gap-0.5 rounded-xl bg-popover/95 p-1.5 shadow-2xl backdrop-blur"
          style={{ left: menuPosition.x, top: menuPosition.y }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={playNext}>
            <SkipNextIcon size={18} aria-hidden="true" />
            <span className="flex-1">Play next</span>
          </button>
          <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={addToQueue}>
            <ListIcon size={18} aria-hidden="true" />
            <span className="flex-1">Add to queue</span>
          </button>
          <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={openPicker}>
            <PlaylistAddIcon size={18} aria-hidden="true" />
            <span className="flex-1">Add to playlist</span>
            <kbd>Ctrl S</kbd>
          </button>
          {canLikeSelectedTrack && (
            <button
              type="button"
              role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => {
                if (!track) return;
                setMenuPosition(null);
                void toggleTrackLike(track);
              }}
            >
              {selectedTrackIsLiked ? (
                <HeartActiveIcon size={18} aria-hidden="true" />
              ) : (
                <HeartIcon size={18} aria-hidden="true" />
              )}
              <span className="flex-1">
                {selectedTrackIsLiked ? "Remove like" : "Like song"}
              </span>
            </button>
          )}
          {canCopySelectedTrackLink && (
            <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => void copyLink()}>
              <LinkIcon size={18} aria-hidden="true" />
              <span className="flex-1">Copy link</span>
            </button>
          )}
          {canRemoveSelectedTrackFromPlaylist && (
            <button
              type="button"
              role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => void removeFromPlaylist()}
              disabled={Boolean(addingPlaylistId || isRemovingTrack)}
            >
              <TrashIcon size={18} aria-hidden="true" />
              <span className="flex-1">Remove from playlist</span>
            </button>
          )}
        </div>
      )}

      {isPickerOpen && track && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm"
          onMouseDown={() => {
            if (!addingPlaylistId) setIsPickerOpen(false);
          }}
        >
          <section
            className="flex max-h-[70vh] w-[min(28rem,90vw)] flex-col gap-3 rounded-2xl bg-popover p-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Add ${track.title} to playlist`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-center gap-3">
              <TrackArtwork
                className="size-11 shrink-0 rounded-lg object-cover"
                artworkUrl={track.artworkUrl}
                iconSize={24}
                loading="eager"
              />
              <div className="flex min-w-0 flex-1 flex-col text-sm [&_small]:truncate [&_small]:text-xs [&_small]:text-muted-foreground [&_strong]:truncate [&_strong]:font-medium">
                <strong>{track.title}</strong>
                <small>
                  <ArtistLinks artists={track.artists} fallback={track.artist} />
                </small>
              </div>
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                disabled={Boolean(addingPlaylistId)}
                onClick={() => setIsPickerOpen(false)}
                aria-label="Close playlist picker"
              >
                <CloseIcon size={19} />
              </button>
            </header>

            <label className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2 text-muted-foreground [&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:text-sm [&_input]:text-foreground [&_input]:outline-none">
              <SearchIcon size={18} aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedPlaylistIndex(null);
                }}
                onKeyDown={handlePickerKeyDown}
                placeholder="Find a playlist"
                aria-label="Find a playlist"
              />
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {libraryState.status === "signed-out" ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Sign in to YouTube Music to add songs.</p>
              ) : playlists.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {query ? "No matching playlists." : "No editable playlists were found."}
                </p>
              ) : (
                playlists.map((playlist, index) => (
                  <button
                    key={playlist.id}
                    ref={(element) => {
                      playlistRefs.current[index] = element;
                    }}
                    type="button"
                    className={cn(PICKER_ROW, selectedPlaylistIndex === index && "bg-primary/15 text-foreground")}
                    disabled={Boolean(addingPlaylistId)}
                    onMouseMove={() => setSelectedPlaylistIndex(null)}
                    onClick={() => void addToPlaylist(playlist)}
                  >
                    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-card text-muted-foreground [&_img]:size-full [&_img]:object-cover">
                      {playlist.artworkUrl ? (
                        <img src={playlist.artworkUrl} alt="" />
                      ) : (
                        <PlaylistIcon size={24} aria-hidden="true" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col text-left [&_span]:truncate [&_span]:text-xs [&_span]:text-muted-foreground [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-medium">
                      <strong>{playlist.title}</strong>
                      <span>{playlist.owner}</span>
                    </span>
                    {addingPlaylistId === playlist.id && (
                      <span className="shrink-0 text-xs text-muted-foreground">Adding...</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-28 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-popover/95 px-4 py-2 text-sm text-foreground shadow-2xl backdrop-blur" role="status">
          {addingPlaylistId || isRemovingTrack || isLikeMutationPending ? (
            <Loader variant="spinner" size={18} />
          ) : toast === "Already in playlist" ? (
            <CloseIcon size={16} aria-hidden="true" />
          ) : (toast.startsWith("Added ") || toast.includes("will play next") || toast === "Link copied" || toast.startsWith("Removed from ")) && (
            <CheckIcon size={18} aria-hidden="true" />
          )}
          <span>{toast}</span>
        </div>
      )}
    </TrackContextMenuContext.Provider>
  );
}
