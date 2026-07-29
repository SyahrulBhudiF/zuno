/**
 * Self-check for lyric line timing. No test runner in this project, so:
 *
 *   npx esbuild src/ui/pages/lyricsTiming.check.ts --bundle --platform=node --format=esm
 *     --outfile=check.mjs && node check.mjs
 *
 * This is the logic that decides which line is lit, and it runs on every animation frame
 * against provider data that is routinely half-formed. The cases below are the ones that
 * actually show up: unsynced text, a gap before the first line, and the last line running
 * to the end of the song.
 */
export {};

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  check(actual === expected, `${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const { findActiveLineIndex, isSyncedLyrics } = await import("./lyricsTiming");

const LINES = [
  { text: "first", startTimeSec: 10 },
  { text: "second", startTimeSec: 20 },
  { text: "third", startTimeSec: 30 },
];

equal(findActiveLineIndex(LINES, 0), -1, "before the first line nothing is lit");
equal(findActiveLineIndex(LINES, 9.99), -1, "still nothing a hair before the first start");
equal(findActiveLineIndex(LINES, 10), 0, "the first line lights exactly on its start");
equal(findActiveLineIndex(LINES, 19.9), 0, "it stays lit until the next one starts");
equal(findActiveLineIndex(LINES, 25), 1, "mid-song lands on the line that started last");
equal(findActiveLineIndex(LINES, 9_999), 2, "the last line holds to the end of the song");
equal(findActiveLineIndex([], 5), -1, "no lines means no active line");

// A line missing a start time stops the scan: past it the timings are meaningless, and
// guessing would slide the highlight onto the wrong words.
equal(
  findActiveLineIndex([{ text: "a", startTimeSec: 1 }, { text: "b" }, { text: "c", startTimeSec: 3 }], 5),
  0,
  "the scan stops at the first untimed line",
);

check(isSyncedLyrics({ lines: LINES, timing: "synced" }), "fully timed lines are synced");
check(
  isSyncedLyrics({ lines: LINES, timing: "estimated" }),
  "estimated timings still drive the highlight",
);
check(!isSyncedLyrics(null), "no lyrics are not synced");
check(!isSyncedLyrics({ lines: [], timing: "synced" }), "an empty line list is not synced");
check(
  !isSyncedLyrics({ lines: [{ text: "a" }, { text: "b" }], timing: "none" }),
  "plain text lyrics are not synced",
);
check(
  !isSyncedLyrics({ lines: [{ text: "a", startTimeSec: 1 }, { text: "b" }], timing: "synced" }),
  "one untimed line disqualifies the whole set, whatever the provider claims",
);

console.log("lyricsTiming self-check passed");
