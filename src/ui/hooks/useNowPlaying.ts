import { usePlayerState } from "../../player/playerStore";

export interface NowPlaying {
  /** Id of the track the player is on, or null when idle. */
  currentTrackId: string | null;
  /** Whether that track is actually advancing, as opposed to paused. */
  isPlaying: boolean;
}

/**
 * The two facts a track list needs to mark its rows.
 *
 * Narrowing to primitives here is deliberate: the pages never touch the player state object,
 * so `TrackRow`'s memo comparison stays cheap and a row only re-renders when its own
 * highlight actually changes.
 *
 * Playback *position* is intentionally absent. It lives in SeekBar's local state, so a
 * 500-row playlist is not re-rendered several times a second just to move a progress bar.
 */
export function useNowPlaying(): NowPlaying {
  const state = usePlayerState();
  return {
    currentTrackId: state.currentTrack?.id ?? null,
    isPlaying: state.status === "playing",
  };
}
