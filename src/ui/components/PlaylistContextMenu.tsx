import {
  createContext,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Loader } from "@/components/motion/loader";
import { BookmarkActiveIcon, BookmarkIcon, CheckIcon, CopyIcon, TrashIcon } from "@/ui/icons";
import type { Album, Playlist } from "../../datasource/types";
import type { LibraryController } from "../../player/LibraryController";
import { deleteLocalPlaylist, isLocalPlaylist } from "../../player/localPlaylists";

interface PlaylistContextMenuValue {
  openPlaylistMenu: (event: ReactMouseEvent, playlist: Playlist) => void;
  openAlbumMenu: (event: ReactMouseEvent, album: Album) => void;
}

const PlaylistContext = createContext<PlaylistContextMenuValue | null>(null);

export function usePlaylistContextMenu(): PlaylistContextMenuValue {
  const value = useContext(PlaylistContext);
  if (!value) {
    throw new Error("usePlaylistContextMenu must be used within PlaylistContextMenuProvider.");
  }
  return value;
}

export function PlaylistContextMenuProvider({
  children,
  libraryController,
}: {
  children: ReactNode;
  libraryController: LibraryController;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, [position]);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!position) return;

    const keepMenuInViewport = () => {
      const menu = menuRef.current;
      if (!menu) return;

      const viewportMargin = 8;
      const bounds = menu.getBoundingClientRect();
      const x = Math.max(
        viewportMargin,
        Math.min(position.x, window.innerWidth - bounds.width - viewportMargin),
      );
      const y = Math.max(
        viewportMargin,
        Math.min(position.y, window.innerHeight - bounds.height - viewportMargin),
      );

      if (x !== position.x || y !== position.y) {
        setPosition({ x, y });
      }
    };

    keepMenuInViewport();
    window.addEventListener("resize", keepMenuInViewport);
    return () => window.removeEventListener("resize", keepMenuInViewport);
  }, [album, playlist, position]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  const showPersistentToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const openPlaylistMenu = (event: ReactMouseEvent, selected: Playlist) => {
    event.preventDefault();
    event.stopPropagation();
    setPlaylist(selected);
    setAlbum(null);
    setPosition({ x: event.clientX, y: event.clientY });
  };

  const openAlbumMenu = (event: ReactMouseEvent, selected: Album) => {
    event.preventDefault();
    event.stopPropagation();
    setAlbum(selected);
    setPlaylist(null);
    setPosition({ x: event.clientX, y: event.clientY });
  };

  const isSaved = album
    ? libraryController.isAlbumSaved(album.id) || Boolean(album.playlistId && libraryController.isAlbumSaved(album.playlistId))
    : false;

  const isLocalPlaylistMenu = playlist ? isLocalPlaylist(playlist) : false;
  const canCopyPlaylistUrl = Boolean(
    playlist
      && !isLocalPlaylistMenu
      && playlist.kind !== "liked-songs"
      && playlist.id !== "LM",
  );

  const getAlbumUrl = (album: Album): string => {
    if (album.id.startsWith("UC")) {
      return `https://music.youtube.com/channel/${encodeURIComponent(album.id)}`;
    }
    if (album.id) {
      return `https://music.youtube.com/browse/${encodeURIComponent(album.id)}`;
    }
    return `https://music.youtube.com/search?q=${encodeURIComponent(album.title)}`;
  };

  const getPlaylistUrl = (playlist: Playlist): string => {
    const playlistId = playlist.id.replace(/^VL/, "");
    return `https://music.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
  };

  const toggleAlbumSaved = async () => {
    if (!album || isSaving) return;
    const saved = libraryController.isAlbumSaved(album.id)
      || Boolean(album.playlistId && libraryController.isAlbumSaved(album.playlistId));
    setPosition(null);
    setIsSaving(true);
    showPersistentToast(saved ? "Removing..." : "Saving...");
    try {
      await libraryController.setAlbumSaved(album, !saved);
      showToast(saved ? "Removed from library" : "Saved to library");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update this album.");
    } finally {
      setIsSaving(false);
    }
  };

  const copyAlbumUrl = async () => {
    if (!album || isSaving) return;
    setPosition(null);
    try {
      await navigator.clipboard.writeText(getAlbumUrl(album));
      showToast("Url copied to clipboard");
    } catch {
      showToast("Unable to copy the link.");
    }
  };

  const copyPlaylistUrl = async () => {
    if (!playlist || isSaving) return;
    setPosition(null);
    try {
      await navigator.clipboard.writeText(getPlaylistUrl(playlist));
      showToast("Url copied to clipboard");
    } catch {
      showToast("Unable to copy the link.");
    }
  };

  const deleteSelectedLocalPlaylist = () => {
    if (!playlist || !isLocalPlaylist(playlist)) return;
    deleteLocalPlaylist(playlist.id);
    setPosition(null);
    showToast("Local playlist deleted");
  };

  return (
    <PlaylistContext.Provider value={{ openPlaylistMenu, openAlbumMenu }}>
      {children}
      {position && (album || isLocalPlaylistMenu || canCopyPlaylistUrl) && (
        <div
          ref={menuRef}
          className="fixed z-50 flex min-w-56 flex-col gap-0.5 rounded-xl bg-popover/95 p-1.5 shadow-2xl backdrop-blur"
          style={{ left: position.x, top: position.y }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {album && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => void copyAlbumUrl()}
            >
              <CopyIcon size={18} />
              <span>Copy album URL</span>
            </button>
          )}
          {canCopyPlaylistUrl && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => void copyPlaylistUrl()}
            >
              <CopyIcon size={18} />
              <span>Copy playlist URL</span>
            </button>
          )}
          {isLocalPlaylistMenu && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={deleteSelectedLocalPlaylist}
            >
              <TrashIcon size={18} />
              <span>Delete local playlist</span>
            </button>
          )}
          {album && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => void toggleAlbumSaved()}
            >
              {isSaved ? <BookmarkActiveIcon size={18} /> : <BookmarkIcon size={18} />}
              <span>{isSaved ? "Remove from library" : "Save to library"}</span>
            </button>
          )}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-28 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-popover/95 px-4 py-2 text-sm text-foreground shadow-2xl backdrop-blur" role="status">
          {isSaving ? (
            <Loader variant="spinner" size={18} />
          ) : (toast.startsWith("Saved ") || toast.startsWith("Removed ") || toast === "Url copied to clipboard" || toast === "Local playlist deleted") && (
            <CheckIcon size={18} aria-hidden="true" />
          )}
          <span>{toast}</span>
        </div>
      )}
    </PlaylistContext.Provider>
  );
}
