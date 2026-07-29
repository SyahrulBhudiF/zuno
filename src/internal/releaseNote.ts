import { getVersion } from "@tauri-apps/api/app";
import { getAppSetting, setAppSetting } from "./appSettings";

/**
 * The note shown once, after an update installs.
 *
 * Edit `RELEASE_NOTE_BODY` for each release and nothing else: the note is tied to the
 * installed version, not to a hand-maintained "should I show this" flag, so shipping a new
 * version is all it takes to show the new text exactly once per machine.
 */
const SEEN_VERSION_KEY = "release-note-seen-version";

export const RELEASE_NOTE_BODY = `This is the last major update for a while, with a lot of new features and bug fixes. I'll be away for a bit, but I'll still ship patches for anything critical.

Come say hello at /r/myzuno, and report anything broken on GitHub.

Thank you, and enjoy :)`;

export type ReleaseNoteSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string; url: string };

/* Subreddits and bare URLs. Kept narrow on purpose: `/r/name` is unambiguous, and anything
   cleverer would start linkifying ordinary prose. */
const LINK_PATTERN = /(https?:\/\/[^\s)]+|\/r\/[A-Za-z0-9_]+)/g;

/**
 * Splits the note into text and links.
 *
 * The body stays a plain string so writing the next release's note is just typing — mention a
 * subreddit or paste a URL and it becomes a link, with no markup to get wrong and no markdown
 * renderer to escape against.
 */
export function parseReleaseNote(body: string): ReleaseNoteSegment[] {
  const segments: ReleaseNoteSegment[] = [];
  let lastIndex = 0;

  // `matchAll` rather than a stateful `exec` loop: the regex is module-level, and a shared
  // `lastIndex` across calls is the classic way this silently skips matches on a second run.
  for (const match of body.matchAll(LINK_PATTERN)) {
    const value = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      segments.push({ kind: "text", value: body.slice(lastIndex, start) });
    }
    segments.push({
      kind: "link",
      value,
      url: value.startsWith("/r/") ? `https://www.reddit.com${value}` : value,
    });
    lastIndex = start + value.length;
  }

  if (lastIndex < body.length) {
    segments.push({ kind: "text", value: body.slice(lastIndex) });
  }
  return segments;
}

/**
 * Whether this launch is the first one after an update.
 *
 * A fresh install is deliberately not an update: `lastSeen` is null there, and greeting a
 * first-time user with "here is what changed" is noise about software they have never run.
 * That case records the version silently instead, so their *next* update does show one.
 *
 * Any difference counts, not just an increase — a downgrade or a sideways build is still a
 * version whose notes the user has not read, and comparing version strings numerically is a
 * parser nobody needs here.
 */
export function shouldShowReleaseNote(
  installedVersion: string,
  lastSeenVersion: string | null,
): boolean {
  if (!installedVersion) return false;
  if (lastSeenVersion === null) return false;
  return lastSeenVersion !== installedVersion;
}

function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeSeenVersion(version: string): void {
  try {
    localStorage.setItem(SEEN_VERSION_KEY, version);
  } catch {
    // The durable copy below is what survives a cleared profile anyway.
  }
  void setAppSetting(SEEN_VERSION_KEY, version);
}

/**
 * The version to show a note for, or null.
 *
 * Records silently in every case that is not an update, so this only ever answers "yes" once
 * per new version.
 */
export async function resolveReleaseNoteVersion(): Promise<string | null> {
  let installedVersion: string;
  try {
    installedVersion = await getVersion();
  } catch {
    // Not running under Tauri, or the call failed: no version, no note.
    return null;
  }

  // The durable copy wins: local storage is cleared far more often than app settings, and a
  // cleared profile must not replay an old note as though it were new.
  const durable = await getAppSetting<string>(SEEN_VERSION_KEY).catch(() => null);
  const lastSeenVersion = typeof durable === "string" ? durable : readSeenVersion();

  if (shouldShowReleaseNote(installedVersion, lastSeenVersion)) return installedVersion;

  if (lastSeenVersion !== installedVersion) writeSeenVersion(installedVersion);
  return null;
}

/** Called once the user has actually seen it, so an unclean exit shows it again. */
export function markReleaseNoteSeen(version: string): void {
  writeSeenVersion(version);
}
