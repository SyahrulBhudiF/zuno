import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader } from "@/components/motion/loader";
import { CheckIcon, CopyIcon, ShuffleActiveIcon, UserIcon, UserPlusIcon } from "@/ui/icons";
import type { Album, Artist, ArtistPage, Playlist, Track } from "../../datasource/types";
import { getArtworkUrlCandidates } from "../../datasource/youtube/artwork";
import type { LibraryController } from "../../player/LibraryController";
import type { PlayerControllerActions } from "../../player/playerStore";
import { shuffleTracks } from "../../player/shuffleTracks";
import { AlbumCard } from "../components/AlbumCard";
import { ArtistLinks } from "../components/ArtistLinks";
import { TrackRow } from "../components/TrackRow";
import { useNowPlaying } from "../hooks/useNowPlaying";
import { usePlaylistContextMenu } from "../components/PlaylistContextMenu";
import { useTrackContextMenu } from "../components/TrackContextMenu";

type ReleaseFilter = "all" | "album" | "single" | "ep";

function compactViews(track: Track): string {
  if (track.viewCount) {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(track.viewCount);
  }
  return track.viewCountText
    ? track.viewCountText.replace(/\s*\b(?:views?|plays?)\b\.?/i, "").trim()
    : "";
}

function getArtistUrl(artist: Artist): string {
  if (artist.id.startsWith("UC")) {
    return `https://music.youtube.com/channel/${encodeURIComponent(artist.id)}`;
  }
  if (artist.id) {
    return `https://music.youtube.com/browse/${encodeURIComponent(artist.id)}`;
  }
  return `https://music.youtube.com/search?q=${encodeURIComponent(artist.name)}`;
}

export function ArtistView({
  artist,
  playerController,
  libraryController,
  onOpenAlbum,
  onOpenPlaylist,
}: {
  artist?: Artist;
  playerController: PlayerControllerActions;
  libraryController: LibraryController;
  onOpenAlbum: (album: Album) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
}) {
  const { openTrackMenu } = useTrackContextMenu();
  const { openPlaylistMenu, openAlbumMenu } = usePlaylistContextMenu();
  const { currentTrackId, isPlaying } = useNowPlaying();
  const [page, setPage] = useState<ArtistPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReleaseFilter>("all");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!artist) return;
    let active = true;
    setPage(null);
    setIsLoading(true);
    setError(null);
    setFilter("all");
    void libraryController.getArtist(artist.id, (updated) => {
      if (active) setPage(updated);
    })
      .then((result) => {
        if (active) setPage(result);
      })
      .catch(() => {
        if (active) setError("Unable to load this artist.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [artist, libraryController]);

  const releaseTypes = useMemo(
    () => new Set(page?.releases.map((release) => release.releaseType) ?? []),
    [page?.releases],
  );
  const releaseFilters = useMemo(
    () => (["all", "album", "single", "ep"] as const)
      .filter((type) => type === "all" || releaseTypes.has(type)),
    [releaseTypes],
  );
  const activeFilterIndex = Math.max(0, releaseFilters.indexOf(filter));
  const visibleReleases = page?.releases.filter(
    (release) => filter === "all" || release.releaseType === filter,
  ) ?? [];

  const displayedArtist = page?.artist ?? artist;
  const artistArtworkCandidates = useMemo(
    () => getArtworkUrlCandidates(displayedArtist?.artworkUrl),
    [displayedArtist?.artworkUrl],
  );
  const [artistArtworkIndex, setArtistArtworkIndex] = useState(0);
  const currentArtistArtworkUrl = artistArtworkCandidates[artistArtworkIndex];
  const popularSongs = page?.popularSongs.slice(0, 6) ?? [];

  useEffect(() => {
    setArtistArtworkIndex(0);
    setIsSubscribed(page?.subscribed ?? false);
  }, [displayedArtist?.artworkUrl, displayedArtist?.id, page?.subscribed]);

  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);

  if (!artist || !displayedArtist) return null;

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  const playShuffled = () => {
    const shuffled = shuffleTracks(page?.allSongs ?? []);
    if (shuffled[0]) {
      void playerController.playTrackById(shuffled[0].id, shuffled);
    }
  };

  const toggleArtistSubscription = async () => {
    if (isSubscribing) return;
    const nextSubscribed = !isSubscribed;
    setIsSubscribing(true);
    try {
      await libraryController.setArtistSubscribed(displayedArtist, nextSubscribed);
      setIsSubscribed(nextSubscribed);
    } catch (subscribeError) {
      showToast(
        subscribeError instanceof Error
          ? subscribeError.message
          : "Unable to update this subscription.",
      );
    } finally {
      setIsSubscribing(false);
    }
  };

  const copyArtistUrl = async () => {
    try {
      await navigator.clipboard.writeText(getArtistUrl(displayedArtist));
      showToast("Url copied to clipboard");
    } catch {
      showToast("Unable to copy the link.");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end gap-5">
        <div className="size-44 shrink-0 rounded-full object-cover shadow-2xl">
          {currentArtistArtworkUrl ? (
            <img
              key={currentArtistArtworkUrl}
              src={currentArtistArtworkUrl}
              alt=""
              onError={() => {
                setArtistArtworkIndex((prev) => prev + 1);
                // If all candidates failed, try the raw URL one final time
                // (the raw URL may work without size parameters).
                if (artistArtworkIndex >= artistArtworkCandidates.length - 1) {
                  setArtistArtworkIndex(0);
                }
              }}
            />
          ) : (
            <UserIcon size={84} strokeWidth={1.4} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Artist</span>
          <h1>
            <button
              type="button"
              className="group/title flex items-center gap-2 text-left text-3xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void copyArtistUrl()}
              aria-label={`Copy ${displayedArtist.name} URL`}
            >
              <span>{displayedArtist.name}</span>
              <CopyIcon className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100" size={24} aria-hidden="true" />
            </button>
          </h1>
          {displayedArtist.subscriberCount && (
            <p>{displayedArtist.subscriberCount}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            disabled={isLoading || Boolean(error) || isSubscribing}
            onClick={() => void toggleArtistSubscription()}
          >
            {isSubscribing ? (
              <Loader variant="spinner" size={18} />
            ) : isSubscribed ? (
              <CheckIcon size={18} />
            ) : (
              <UserPlusIcon size={18} />
            )}
            <span>
              {isSubscribing
                ? isSubscribed ? "Unsubscribing..." : "Subscribing..."
                : isSubscribed ? "Subscribed" : "Subscribe"}
            </span>
          </button>
          <button
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            disabled={isLoading || Boolean(error) || !page?.allSongs.length}
            onClick={playShuffled}
          >
            <ShuffleActiveIcon size={18} />
            <span>Shuffle</span>
          </button>
        </div>
      </header>

      {isLoading && <p className="px-2 py-10 text-center text-sm text-muted-foreground">Loading artist...</p>}
      {error && <p className="px-2 py-10 text-center text-sm text-muted-foreground">{error}</p>}

      {!isLoading && !error && page && (
        <>
          {popularSongs.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2>Popular</h2>
              <div className="flex flex-col gap-0.5">
                {popularSongs.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index}
                    isCurrent={currentTrackId !== null && track.id === currentTrackId}
                    isPlaying={isPlaying && track.id === currentTrackId}
                    suppressArtistId={displayedArtist.id}
                    trailing={
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {compactViews(track)}
                      </span>
                    }
                    onSelect={() => void playerController.playTrackById(track.id, page.allSongs)}
                    onContextMenu={(event) => openTrackMenu(event, track)}
                  />
                ))}
              </div>
            </section>
          )}

          {page.releases.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2>Releases</h2>
                <div
                  className="flex flex-wrap items-center gap-1.5 self-start [&>button]:flex [&>button]:min-h-8 [&>button]:min-w-0 [&>button]:items-center [&>button]:justify-center [&>button]:gap-1.5 [&>button]:rounded-full [&>button]:bg-white/[0.04] [&>button]:px-3 [&>button]:text-sm [&>button]:font-medium [&>button]:text-muted-foreground [&>button]:transition-colors hover:[&>button]:bg-white/[0.08] hover:[&>button]:text-foreground focus-visible:[&>button]:outline-none focus-visible:[&>button]:ring-2 focus-visible:[&>button]:ring-ring"
                  role="group"
                  aria-label="Release type"
                  style={{
                    "--active-filter-offset": `${activeFilterIndex * 100}%`,
                    "--filter-count": releaseFilters.length,
                  } as CSSProperties}
                >
                  {releaseFilters
                    .map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={filter === type ? "bg-primary/15 text-foreground" : ""}
                        aria-pressed={filter === type}
                        onClick={() => setFilter(type)}
                      >
                        {type === "all"
                          ? "All"
                          : type === "ep"
                            ? "EPs"
                            : `${type[0].toUpperCase()}${type.slice(1)}s`}
                      </button>
                    ))}
                </div>
              </div>
              <div key={filter} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))] grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
                {visibleReleases.map((release) => {
                  const hasLinkedArtists = Boolean(release.artists?.length);
                  return (
                    <div key={release.id} className="">
                      <AlbumCard
                        artworkUrl={release.artworkUrl}
                        title={release.title}
                        subtitle={hasLinkedArtists ? undefined : release.artist}
                        subtitleContent={hasLinkedArtists
                          ? (
                              <ArtistLinks
                                artists={release.artists}
                                fallback={release.artist}
                                suppressArtistId={displayedArtist.id}
                              />
                            )
                          : undefined}
                        onClick={() => onOpenAlbum(release)}
                        onContextMenu={(event) => openAlbumMenu(event, release)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {page.playlists.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2>Playlists</h2>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
                {page.playlists.map((playlist) => (
                  <AlbumCard
                    key={playlist.id}
                    artworkUrl={playlist.artworkUrl}
                    title={playlist.title}
                    subtitle={playlist.owner}
                    onClick={() => onOpenPlaylist(playlist)}
                    onContextMenu={(event) => openPlaylistMenu(event, playlist)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {toast && createPortal(
        <div className="fixed bottom-28 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-popover/95 px-4 py-2 text-sm text-foreground shadow-2xl backdrop-blur" role="status">
          {toast === "Url copied to clipboard" && (
            <CheckIcon size={18} aria-hidden="true" />
          )}
          <span>{toast}</span>
        </div>,
        document.body,
      )}
    </div>
  );
}
