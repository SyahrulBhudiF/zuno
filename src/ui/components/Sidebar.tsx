import { useState, useRef, useEffect, useMemo, useSyncExternalStore, type ReactElement } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/motion/tooltip";
import { RailPopover } from "./RailPopover";
import { isLikedSongsId, likedSongsCover } from "../likedSongsArtwork";
import {
  AlbumIcon,
  FolderIcon,
  PlaylistIcon,
  PlusIcon,
  RefreshIcon,
} from "@/ui/icons";
import type { Album, Playlist } from "../../datasource/types";
import { libraryController, useLibraryState } from "../../player/playerStore";
import {
  getRecentPlaylistTimestamp,
  subscribeToRecentPlaylists,
} from "../../player/recentPlaylists";
import {
  createLocalPlaylist,
  getLocalPlaylistItems,
  localPlaylistToPlaylist,
  subscribeToLocalPlaylists,
} from "../../player/localPlaylists";
import { getAppSetting, setAppSetting } from "../../internal/appSettings";
import { ArtistLinks } from "./ArtistLinks";
import { TrackArtwork } from "./TrackArtwork";
import { usePlaylistContextMenu } from "./PlaylistContextMenu";
 
const PLAYLIST_ORDER_KEY = "ytc-sidebar-playlist-order";
const ALBUM_ORDER_KEY = "ytc-sidebar-album-order";
const PLAYLIST_LIKED_ORDER_MIGRATION_KEY = "ytc-sidebar-playlist-liked-order-v1";
const ALBUM_LIKED_ORDER_MIGRATION_KEY = "ytc-sidebar-album-liked-order-v1";

function loadOrderFromStorage(key: string, migrationKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const order = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
    if (order.includes("LM") && localStorage.getItem(migrationKey) !== "true") {
      const migratedOrder = ["LM", ...order.filter((id) => id !== "LM")];
      localStorage.setItem(key, JSON.stringify(migratedOrder));
      localStorage.setItem(migrationKey, "true");
      return migratedOrder;
    }
    return order;
  } catch {
    return [];
  }
}

function saveOrderToStorage(key: string, order: string[], migrationKey?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(order));
    if (migrationKey) localStorage.setItem(migrationKey, "true");
  } catch {
    // ignore storage failures
  }
  void setAppSetting(key, order);
  if (migrationKey) void setAppSetting(migrationKey, true);
}

function isStoredOrder(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function reorderIds(ids: string[], draggedId: string, targetId: string, insertAfter: boolean) {
  const nextIds = ids.filter((id) => id !== draggedId);
  const targetIndex = nextIds.indexOf(targetId);
  if (targetIndex < 0) return ids;
  const insertIndex = targetIndex + (insertAfter ? 1 : 0);
  nextIds.splice(insertIndex, 0, draggedId);
  return nextIds;
}

function mergeVisibleOrderWithStoredOrder(storedOrder: string[], visibleOrder: string[]) {
  if (!storedOrder.length) return visibleOrder;

  const visibleIds = new Set(visibleOrder);
  const hiddenIds = storedOrder.filter((id) => !visibleIds.has(id));
  const nextOrder = [...storedOrder];
  let visibleIndex = 0;

  for (let index = 0; index < nextOrder.length && visibleIndex < visibleOrder.length; index += 1) {
    if (hiddenIds.includes(nextOrder[index])) continue;
    nextOrder[index] = visibleOrder[visibleIndex];
    visibleIndex += 1;
  }

  return [
    ...nextOrder,
    ...visibleOrder.slice(visibleIndex),
  ].filter((id, index, ids) => ids.indexOf(id) === index);
}

interface SidebarProps {
  width: number;
  /** Retained for the callers' benefit; the rail no longer resizes, so it is unused. */
  onWidthChange: (width: number) => void;
  onNavigateAlbum: (album: Album) => void;
  onNavigatePlaylist: (playlist: Playlist) => void;
}

/**
 * Hover label for a collapsed sidebar row.
 *
 * The rail shows artwork only, so the name has to come from somewhere; a native `title`
 * attribute was doing that job, but it is slow to appear, unstyled, and cannot show the
 * owner on a second line. Renders its child untouched when the rail is wide enough to
 * display the text itself, so the wrapper costs nothing in that case.
 */
function SidebarItemTooltip({
  enabled,
  title,
  subtitle,
  children,
}: {
  enabled: boolean;
  title: string;
  subtitle?: string;
  children: ReactElement;
}) {
  if (!enabled) return children;

  return (
    <Tooltip
      side="right"
      delay={20}
      wrapperClassName="block"
      className="bg-muted   border border-border"
      content={
        <span className="flex max-w-56 flex-col gap-0.5 text-left  ">
          <span className="truncate font-medium text-foreground text-sm ">{title}</span>
          {subtitle ? (
            <span className="truncate text-xs   text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
      }
    >
      {children}
    </Tooltip>
  );
}

const COLLAPSED_WIDTH = 100;
const TEXT_HIDE_THRESHOLD = 120;

type LibraryView = "albums" | "playlists";
const EMPTY_STATE =
  "flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-muted-foreground";
const RETRY_BUTTON =
  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Square 40px artwork tile shared by both sidebar lists. */
/**
 * Creates a local playlist from the sidebar rail.
 *
 * Local playlists could previously only be made from Settings, which is a strange place to
 * look for "new playlist" — this puts it where the playlists are. Opens to the right because
 * the rail is 72px wide and a panel below would be clipped by the window edge.
 */
function CreatePlaylistButton({
  collapsed,
  onCreated,
}: {
  collapsed: boolean;
  onCreated: (playlist: Playlist) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the field once the panel has finished unfolding, not while it animates.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 160);
    return () => window.clearTimeout(timer);
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the playlist a name.");
      inputRef.current?.focus();
      return;
    }

    try {
      const created = createLocalPlaylist(trimmed);
      setName("");
      setError(null);
      setOpen(false);
      onCreated(localPlaylistToPlaylist(created));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the playlist.");
    }
  };

  return (
    <RailPopover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      className="w-64"
      trigger={
        <button
          type="button"
          aria-label="New playlist"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn(
            "mx-2 mb-1 flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-card/50 py-2",
            "text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "bg-card text-foreground",
          )}
        >
          <PlusIcon size={18} aria-hidden="true" />
          {!collapsed && <span>New playlist</span>}
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">New local playlist</span>
        <span className="text-xs text-muted-foreground">
          Build a playlist from folders on this computer.
        </span>
        <input
          ref={inputRef}
          className="mt-1 w-full min-w-0 rounded-lg bg-background px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring/60"
          value={name}
          placeholder="Playlist name"
          aria-label="Playlist name"
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
        <button
          type="button"
          className="mt-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={submit}
        >
          Create playlist
        </button>
      </div>
    </RailPopover>
  );
}

const ARTWORK_TILE = "size-10 shrink-0 rounded-md object-cover";
const ARTWORK_FALLBACK =
  "flex size-10 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground";

function SidebarAlbumArtwork({ album }: { album: Album }) {
  if (isLikedSongsId(album.id)) {
    return <img className={ARTWORK_TILE} src={likedSongsCover} alt="" />;
  }

  return (
    <TrackArtwork
      className={ARTWORK_TILE}
      artworkUrl={album.artworkUrl}
      iconSize={24}
      variant="album"
    />
  );
}


function SidebarPlaylistArtwork({ playlist }: { playlist: Playlist }) {
  if (isLikedSongsId(playlist.id, playlist.kind)) {
    return <img className={ARTWORK_TILE} src={likedSongsCover} alt="" />;
  }

  if (playlist.kind === "local") {
    return (
      <div className={ARTWORK_FALLBACK}>
        <FolderIcon size={22} aria-hidden="true" />
      </div>
    );
  }

  return (
    <TrackArtwork
      className={ARTWORK_TILE}
      artworkUrl={playlist.artworkUrl}
      iconSize={24}
      retryOnError
      variant="playlist"
    />
  );
}

export function Sidebar({
  width,
  onNavigateAlbum,
  onNavigatePlaylist,
}: SidebarProps) {
  const libraryState = useLibraryState();
  const { openPlaylistMenu, openAlbumMenu } = usePlaylistContextMenu();
  const [libraryView, setLibraryView] = useState<LibraryView>("playlists");
  const [recentPlaylistsRevision, setRecentPlaylistsRevision] = useState(0);
  const [playlistOrder, setPlaylistOrder] = useState<string[]>(() =>
    loadOrderFromStorage(PLAYLIST_ORDER_KEY, PLAYLIST_LIKED_ORDER_MIGRATION_KEY)
  );
  const [albumOrder, setAlbumOrder] = useState<string[]>(() =>
    loadOrderFromStorage(ALBUM_ORDER_KEY, ALBUM_LIKED_ORDER_MIGRATION_KEY)
  );
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: LibraryView } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; type: LibraryView; insertAfter: boolean } | null>(null);
  const localPlaylists = useSyncExternalStore(
    subscribeToLocalPlaylists,
    getLocalPlaylistItems,
    getLocalPlaylistItems,
  );
  const sidebarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const draggedElementRef = useRef<HTMLElement | null>(null);
  const dragTranslationRef = useRef(0);
  const pointerDragRef = useRef<{
    pointerId: number;
    itemId: string;
    itemType: LibraryView;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);


  const isCollapsed = width <= COLLAPSED_WIDTH;
  const shouldHideText = width <= TEXT_HIDE_THRESHOLD;
  const hasUserCreatedPlaylists = (libraryState.library?.playlists.length ?? 0) + localPlaylists.length > 0;
  const hasLoadedLibrary = Boolean(libraryState.library);
  const showPlaylistRetry =
    libraryView === "playlists" &&
    libraryState.status !== "signed-out" &&
    (hasLoadedLibrary || libraryState.status === "error") &&
    !hasUserCreatedPlaylists;
  const isRetryingPlaylists = libraryState.status === "loading";

  useEffect(() => {
    let active = true;

    const hydrateOrder = async (
      key: string,
      apply: (order: string[]) => void,
    ) => {
      const stored = await getAppSetting<unknown>(key);
      if (!active || !isStoredOrder(stored)) return;

      try {
        localStorage.setItem(key, JSON.stringify(stored));
      } catch {
        // The React state below still restores the order for this session.
      }
      apply(stored);
    };

    void hydrateOrder(PLAYLIST_ORDER_KEY, setPlaylistOrder);
    void hydrateOrder(ALBUM_ORDER_KEY, setAlbumOrder);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (localStorage.getItem(PLAYLIST_LIKED_ORDER_MIGRATION_KEY) !== "true") {
      setPlaylistOrder((current) => {
        if (!current.includes("LM")) return current;
        const migrated = ["LM", ...current.filter((id) => id !== "LM")];
        saveOrderToStorage(
          PLAYLIST_ORDER_KEY,
          migrated,
          PLAYLIST_LIKED_ORDER_MIGRATION_KEY,
        );
        return migrated;
      });
    }

    if (localStorage.getItem(ALBUM_LIKED_ORDER_MIGRATION_KEY) !== "true") {
      setAlbumOrder((current) => {
        if (!current.includes("LM")) return current;
        const migrated = ["LM", ...current.filter((id) => id !== "LM")];
        saveOrderToStorage(
          ALBUM_ORDER_KEY,
          migrated,
          ALBUM_LIKED_ORDER_MIGRATION_KEY,
        );
        return migrated;
      });
    }
  }, []);

  const playlists = useMemo(() => {
    const likedSongsPlaylist = libraryState.library?.likedSongsPlaylist;
    const remotePlaylists = libraryState.library?.playlists ?? [];
    const libraryPlaylists = likedSongsPlaylist
      ? [likedSongsPlaylist, ...localPlaylists, ...remotePlaylists]
      : [...localPlaylists, ...remotePlaylists];
    if (!libraryPlaylists.length) return [];

    const playlistById = new Map(libraryPlaylists.map((playlist) => [playlist.id, playlist]));
    const availableIds = new Set(libraryPlaylists.map((playlist) => playlist.id));
    const savedIds = playlistOrder.filter((id) => availableIds.has(id));

    if (savedIds.length) {
      const missingIds = libraryPlaylists
        .map((playlist) => playlist.id)
        .filter((id) => !savedIds.includes(id));
      const orderedIds = likedSongsPlaylist && !savedIds.includes(likedSongsPlaylist.id)
        ? [likedSongsPlaylist.id, ...savedIds, ...missingIds.filter((id) => id !== likedSongsPlaylist.id)]
        : [...savedIds, ...missingIds];
      return orderedIds
        .map((id) => playlistById.get(id))
        .filter((playlist): playlist is Playlist => Boolean(playlist));
    }

    const defaultPlaylists = libraryPlaylists
      .filter((playlist) => playlist.id !== likedSongsPlaylist?.id && playlist.kind !== "local")
      .map((playlist, libraryIndex) => ({
        playlist,
        libraryIndex,
        playedAt: getRecentPlaylistTimestamp(playlist.id),
      }))
      .sort((left, right) =>
        right.playedAt - left.playedAt || left.libraryIndex - right.libraryIndex
      )
      .map(({ playlist }) => playlist);
    return likedSongsPlaylist
      ? [likedSongsPlaylist, ...localPlaylists, ...defaultPlaylists]
      : [...localPlaylists, ...defaultPlaylists];
  }, [
    libraryState.library?.likedSongsPlaylist,
    libraryState.library?.playlists,
    localPlaylists,
    playlistOrder,
    recentPlaylistsRevision,
  ]);

  const albums = useMemo(() => {
    const likedSongsPlaylist = libraryState.library?.likedSongsPlaylist;
    const likedSongsAlbum: Album | null = likedSongsPlaylist
      ? {
          id: likedSongsPlaylist.id,
          title: "Liked Songs",
          artist: likedSongsPlaylist.owner,
          artworkUrl: likedSongsPlaylist.artworkUrl,
        }
      : null;
    const libraryAlbums = likedSongsAlbum
      ? [likedSongsAlbum, ...(libraryState.library?.albums ?? [])]
      : libraryState.library?.albums ?? [];
    if (!libraryAlbums.length) return [];

    const albumById = new Map(libraryAlbums.map((album) => [album.id, album]));
    const availableIds = new Set(libraryAlbums.map((album) => album.id));
    const savedIds = albumOrder.filter((id) => availableIds.has(id));

    if (savedIds.length) {
      const missingIds = libraryAlbums
        .map((album) => album.id)
        .filter((id) => !savedIds.includes(id));
      const orderedIds = likedSongsAlbum && !savedIds.includes(likedSongsAlbum.id)
        ? [likedSongsAlbum.id, ...savedIds, ...missingIds.filter((id) => id !== likedSongsAlbum.id)]
        : [...savedIds, ...missingIds];
      return orderedIds
        .map((id) => albumById.get(id))
        .filter((album): album is Album => Boolean(album));
    }

    return libraryAlbums;
  }, [
    libraryState.library?.likedSongsPlaylist,
    libraryState.library?.albums,
    albumOrder,
  ]);

  useEffect(
    () => subscribeToRecentPlaylists(
      () => setRecentPlaylistsRevision((revision) => revision + 1),
    ),
    [],
  );

  useEffect(() => {
    if (!libraryState.library && !localPlaylists.length) return;
    if (!libraryState.library) {
      if (playlistOrder.length === 0) return;

      const localPlaylistIds = localPlaylists.map((playlist) => playlist.id);
      const normalized = [
        ...playlistOrder,
        ...localPlaylistIds.filter((id) => !playlistOrder.includes(id)),
      ].filter((id, index, ids) => ids.indexOf(id) === index);

      if (
        normalized.length !== playlistOrder.length ||
        normalized.some((id, index) => id !== playlistOrder[index])
      ) {
        setPlaylistOrder(normalized);
        saveOrderToStorage(
          PLAYLIST_ORDER_KEY,
          normalized,
          PLAYLIST_LIKED_ORDER_MIGRATION_KEY,
        );
      }
      return;
    }

    const playlistIds = [
      libraryState.library.likedSongsPlaylist.id,
      ...localPlaylists.map((playlist) => playlist.id),
      ...libraryState.library.playlists.map((playlist) => playlist.id),
    ];
    if (playlistOrder.length > 0) {
      const normalized = [
        ...(playlistOrder.includes("LM") ? [] : ["LM"]),
        ...playlistOrder.filter((id) => playlistIds.includes(id)),
        ...playlistIds.filter((id) => !playlistOrder.includes(id)),
      ].filter((id, index, ids) => ids.indexOf(id) === index);
      if (
        normalized.length !== playlistOrder.length ||
        normalized.some((id, index) => id !== playlistOrder[index])
      ) {
        setPlaylistOrder(normalized);
        saveOrderToStorage(
          PLAYLIST_ORDER_KEY,
          normalized,
          PLAYLIST_LIKED_ORDER_MIGRATION_KEY,
        );
      }
    }
  }, [
    libraryState.library?.likedSongsPlaylist,
    libraryState.library?.playlists,
    localPlaylists,
    playlistOrder,
  ]);

  useEffect(() => {
    if (!libraryState.library) return;
    const albumIds = [
      libraryState.library.likedSongsPlaylist.id,
      ...libraryState.library.albums.map((album) => album.id),
    ];
    if (albumOrder.length > 0) {
      const normalized = [
        ...(albumOrder.includes("LM") ? [] : ["LM"]),
        ...albumOrder.filter((id) => albumIds.includes(id)),
        ...albumIds.filter((id) => !albumOrder.includes(id)),
      ].filter((id, index, ids) => ids.indexOf(id) === index);
      if (
        normalized.length !== albumOrder.length ||
        normalized.some((id, index) => id !== albumOrder[index])
      ) {
        setAlbumOrder(normalized);
        saveOrderToStorage(
          ALBUM_ORDER_KEY,
          normalized,
          ALBUM_LIKED_ORDER_MIGRATION_KEY,
        );
      }
    }
  }, [
    libraryState.library?.likedSongsPlaylist,
    libraryState.library?.albums,
    albumOrder,
  ]);

  const playlistsRef = useRef<string[]>([]);
  const albumsRef = useRef<string[]>([]);

  useEffect(() => {
    playlistsRef.current = playlists.map((playlist) => playlist.id);
  }, [playlists]);

  useEffect(() => {
    albumsRef.current = albums.map((album) => album.id);
  }, [albums]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (!drag.isDragging) {
        const distance = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        );
        if (distance < 6) return;

        drag.isDragging = true;
        setDraggedItem({ id: drag.itemId, type: drag.itemType });
      }

      const translationY = event.clientY - drag.startY;
      dragTranslationRef.current = translationY;
      if (draggedElementRef.current) {
        draggedElementRef.current.style.setProperty("--drag-translation", `${translationY}px`);
      }
      event.preventDefault();
      const pointerCandidates = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>("[data-sidebar-item-id]"))
        .filter((candidate): candidate is HTMLElement => Boolean(candidate))
        .filter((candidate) =>
          candidate.dataset.sidebarItemId !== drag.itemId &&
          candidate.dataset.sidebarItemType === drag.itemType,
        );

      const uniqueCandidates = Array.from(
        new Map(pointerCandidates.map((item) => [item.dataset.sidebarItemId, item])).values(),
      );

      let targetElement = uniqueCandidates.length
        ? uniqueCandidates.reduce<HTMLElement | null>((closestSoFar, item) => {
            const itemRect = item.getBoundingClientRect();
            const centerY = itemRect.top + itemRect.height / 2;
            if (!closestSoFar) return item;
            const closestRect = closestSoFar.getBoundingClientRect();
            const closestCenterY = closestRect.top + closestRect.height / 2;
            return Math.abs(centerY - event.clientY) < Math.abs(closestCenterY - event.clientY)
              ? item
              : closestSoFar;
          }, null)
        : null;

      if (listRef.current) {
        const listRect = listRef.current.getBoundingClientRect();
        const items = Array.from(
          listRef.current.querySelectorAll<HTMLElement>("[data-sidebar-item-id]")
        ).filter((item) =>
          item.dataset.sidebarItemId !== drag.itemId &&
          item.dataset.sidebarItemType === drag.itemType,
        );

        if (event.clientY < listRect.top && items.length) {
          targetElement = items[0];
        } else if (event.clientY > listRect.bottom && items.length) {
          targetElement = items[items.length - 1];
        } else if (!targetElement && event.clientY >= listRect.top && event.clientY <= listRect.bottom && items.length) {
          targetElement = items.reduce<HTMLElement | null>((closestSoFar, item) => {
            const itemRect = item.getBoundingClientRect();
            const centerY = itemRect.top + itemRect.height / 2;
            if (!closestSoFar) return item;
            const closestRect = closestSoFar.getBoundingClientRect();
            const closestCenterY = closestRect.top + closestRect.height / 2;
            return Math.abs(centerY - event.clientY) < Math.abs(closestCenterY - event.clientY)
              ? item
              : closestSoFar;
          }, null);
        }
      }

      if (!targetElement) {
        setDropTarget(null);
        return;
      }

      const targetId = targetElement.dataset.sidebarItemId;
      const targetType = targetElement.dataset.sidebarItemType as LibraryView | undefined;
      if (!targetId || !targetType || targetId === drag.itemId || targetType !== drag.itemType) {
        setDropTarget(null);
        return;
      }

      const bounds = targetElement.getBoundingClientRect();
      setDropTarget({
        id: targetId,
        type: targetType,
        insertAfter: event.clientY >= bounds.top + bounds.height / 2,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (drag.isDragging && dropTarget && dropTarget.type === drag.itemType && dropTarget.id !== drag.itemId) {
        const currentIds =
          drag.itemType === "playlists" ? playlistsRef.current : albumsRef.current;
        const nextOrder = reorderIds(
          currentIds,
          drag.itemId,
          dropTarget.id,
          dropTarget.insertAfter,
        );

        if (drag.itemType === "playlists") {
          const nextPlaylistOrder = mergeVisibleOrderWithStoredOrder(
            playlistOrder,
            nextOrder,
          );
          setPlaylistOrder(nextPlaylistOrder);
          saveOrderToStorage(
            PLAYLIST_ORDER_KEY,
            nextPlaylistOrder,
            PLAYLIST_LIKED_ORDER_MIGRATION_KEY,
          );
        } else {
          setAlbumOrder(nextOrder);
          saveOrderToStorage(
            ALBUM_ORDER_KEY,
            nextOrder,
            ALBUM_LIKED_ORDER_MIGRATION_KEY,
          );
        }

        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      pointerDragRef.current = null;
      if (draggedElementRef.current) {
        draggedElementRef.current.style.removeProperty("--drag-translation");
        draggedElementRef.current.releasePointerCapture?.(event.pointerId);
        draggedElementRef.current.style.removeProperty("will-change");
      }
      draggedElementRef.current = null;
      setDraggedItem(null);
      setDropTarget(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dropTarget, playlistOrder]);

  const handleSidebarItemPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    itemId: string,
    itemType: LibraryView,
  ) => {
    if (event.button !== 0) return;
    pointerDragRef.current = {
      pointerId: event.pointerId,
      itemId,
      itemType,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
    };
    draggedElementRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.willChange = "transform";
  };

  const handleSidebarItemClick = (callback: () => void) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    callback();
  };

  const handlePlaylistRetry = () => {
    if (isRetryingPlaylists) return;
    void libraryController.refresh();
  };

  const isDragActive = Boolean(draggedItem);

  const listClasses = cn(
    "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-3",
    // Narrow sidebar tightens spacing before it drops labels entirely.
    isCollapsed ? "gap-0 px-1" : "gap-0.5 px-2",
    isDragActive && "select-none",
  );

  /** Row styling shared by album and playlist entries, including drop indicators. */
  const itemClasses = (
    id: string,
    type: "albums" | "playlists",
  ) => cn(
    "group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
    "hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    shouldHideText && "justify-center px-0",
    draggedItem?.id === id && draggedItem.type === type && "opacity-40",
    dropTarget?.id === id && dropTarget.type === type && !dropTarget.insertAfter &&
      "before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded-full before:bg-primary",
    dropTarget?.id === id && dropTarget.type === type && dropTarget.insertAfter &&
      "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
  );

  const toggleButtonClasses = (isActive: boolean) => cn(
    "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

  return (
    <div
      ref={sidebarRef}
      className="relative flex min-h-0 shrink-0 flex-col   bg-background backdrop-blur"
      style={{ width: `${width}px` }}
    >
      {/*
        The resize grip is deliberately not rendered: the rail is a fixed icon strip and
        hovering an item explains it, so there is nothing to widen it for. `handleMouseDown`
        and the width plumbing are left intact so restoring it is a one-line change.
      */}

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "m-2 flex shrink-0 items-center gap-1 rounded-lg bg-card/20   p-2",
            shouldHideText && "flex-col",
          )}
          role="group"
          aria-label="Library view"
        >
          <SidebarItemTooltip enabled={shouldHideText} title="Playlists" subtitle="Your playlists">
          <button
            type="button"
            className={toggleButtonClasses(libraryView === "playlists")}
            aria-pressed={libraryView === "playlists"}
            aria-label="User playlists"
            onClick={() => setLibraryView("playlists")}
          >
            {libraryView === "playlists" && (
              <motion.span
                layoutId="sidebar-library-view"
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                className="absolute inset-0 -z-10 rounded-md bg-card"
              />
            )}
            <PlaylistIcon size={17} aria-hidden="true" />
            {!shouldHideText && <span>Playlists</span>}
          </button>
          </SidebarItemTooltip>
          <SidebarItemTooltip enabled={shouldHideText} title="Albums" subtitle="Saved albums">
          <button
            type="button"
            className={toggleButtonClasses(libraryView === "albums")}
            aria-pressed={libraryView === "albums"}
            aria-label="Albums"
            onClick={() => setLibraryView("albums")}
          >
            {libraryView === "albums" && (
              <motion.span
                layoutId="sidebar-library-view"
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                className="absolute inset-0 -z-10 rounded-md bg-card"
              />
            )}
            <AlbumIcon size={17} aria-hidden="true" />
            {!shouldHideText && <span>Albums</span>}
          </button>
          </SidebarItemTooltip>
        </div>

        <CreatePlaylistButton
          collapsed={shouldHideText}
          onCreated={(playlist) => {
            setLibraryView("playlists");
            onNavigatePlaylist(playlist);
          }}
        />
        <div ref={listRef} className={listClasses}>
          {libraryView === "albums" ? (
            albums.map((album) => (
              <SidebarItemTooltip
                key={album.id}
                enabled={shouldHideText}
                title={album.title}
                subtitle={album.artist}
              >
              <button
                type="button"
                data-sidebar-item-id={album.id}
                data-sidebar-item-type="albums"
                className={itemClasses(album.id, "albums")}
                onPointerDown={(event) => handleSidebarItemPointerDown(event, album.id, "albums")}
                onClick={() => handleSidebarItemClick(() => {
                  if (album.id === "LM" && libraryState.library?.likedSongsPlaylist) {
                    onNavigatePlaylist(libraryState.library.likedSongsPlaylist);
                  } else {
                    onNavigateAlbum(album);
                  }
                })}
                onContextMenu={(event) => {
                  if (album.id === "LM" && libraryState.library?.likedSongsPlaylist) {
                    openPlaylistMenu(event, libraryState.library.likedSongsPlaylist);
                    return;
                  }
                  openAlbumMenu(event, album);
                }}
              >
                <SidebarAlbumArtwork album={album} />
                {!shouldHideText && (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-foreground">{album.title}</span>
                    <ArtistLinks
                      className="truncate text-xs text-muted-foreground"
                      artists={album.artists}
                      fallback={album.artist}
                    />
                  </div>
                )}
              </button>
              </SidebarItemTooltip>
            ))
          ) : (
            playlists.length ? (
              <>
                {playlists.map((playlist) => (
                  <SidebarItemTooltip
                    key={playlist.id}
                    enabled={shouldHideText}
                    title={playlist.title}
                    subtitle={playlist.owner}
                  >
                  <button
                    type="button"
                    data-sidebar-item-id={playlist.id}
                    data-sidebar-item-type="playlists"
                    className={itemClasses(playlist.id, "playlists")}
                    onPointerDown={(event) => handleSidebarItemPointerDown(event, playlist.id, "playlists")}
                    onClick={() => handleSidebarItemClick(() => onNavigatePlaylist(playlist))}
                    onContextMenu={(event) => openPlaylistMenu(event, playlist)}
                  >
                    <SidebarPlaylistArtwork playlist={playlist} />
                    {!shouldHideText && (
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-foreground">{playlist.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{playlist.owner}</span>
                      </div>
                    )}
                  </button>
                  </SidebarItemTooltip>
                ))}
                {showPlaylistRetry && (
                  <div className={EMPTY_STATE}>
                    <PlaylistIcon size={28} aria-hidden="true" />
                    {!shouldHideText && (
                      <span>No user-created playlists were found.</span>
                    )}
                    <button
                      type="button"
                      className={RETRY_BUTTON}
                      onClick={handlePlaylistRetry}
                      disabled={isRetryingPlaylists}
                      title="Retry playlist sync"
                      aria-label="Retry playlist sync"
                    >
                      <RefreshIcon size={15} aria-hidden="true" />
                      {!shouldHideText && (
                        <span>{isRetryingPlaylists ? "Retrying..." : "Retry"}</span>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={EMPTY_STATE}>
                <PlaylistIcon size={28} aria-hidden="true" />
                {!shouldHideText && (
                  <span>
                    {libraryState.status === "signed-out"
                      ? "Sign in to see your playlists."
                      : "No user-created playlists were found."}
                  </span>
                )}
                {libraryState.status === "signed-out" && (
                  <button
                    type="button"
                    className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => void libraryController.signIn()}
                    title="Sign in to YouTube Music"
                  >
                    Sign in
                  </button>
                )}
                {showPlaylistRetry && (
                  <button
                    type="button"
                    className={RETRY_BUTTON}
                    onClick={handlePlaylistRetry}
                    disabled={isRetryingPlaylists}
                    title="Retry playlist sync"
                    aria-label="Retry playlist sync"
                  >
                    <RefreshIcon size={15} aria-hidden="true" />
                    {!shouldHideText && (
                      <span>{isRetryingPlaylists ? "Retrying..." : "Retry"}</span>
                    )}
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
