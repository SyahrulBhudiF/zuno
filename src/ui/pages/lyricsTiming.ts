import type { LyricLine, Lyrics } from "../../datasource/types";

/**
 * Whether a set of lines can drive a karaoke highlight.
 *
 * Derived from the lines themselves rather than trusting `timing`: providers disagree about
 * the field (LRCLIB says "synced", a TTML parse may leave gaps), and a single line without a
 * start time is enough to make the highlight jump backwards.
 */
export function isSyncedLyrics(lyrics: Lyrics | null): boolean {
  const lines = lyrics?.lines;
  if (!lines?.length) return false;
  if (lyrics?.timing === "none") return false;
  return lines.every((line) => typeof line.startTimeSec === "number");
}

/**
 * Index of the line that should be lit at `timeSec`, or -1 before the first one starts.
 *
 * A plain forward scan: lyric line counts are in the low hundreds and this runs once per
 * animation frame, so a binary search would buy nothing but an off-by-one to debug at 3am.
 */
export function findActiveLineIndex(lines: LyricLine[], timeSec: number): number {
  let active = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index]?.startTimeSec;
    if (start === undefined || timeSec < start) break;
    active = index;
  }
  return active;
}
