/**
 * Lazy loader for youtubei.js.
 *
 * Statically imported, the InnerTube client was the single largest thing in the entry
 * chunk — roughly 800 kB of the 1.1 MB that had to parse before the first frame, for a
 * library that cannot be used until someone is signed in and a request is made. It is now a
 * chunk of its own, fetched on the first call that actually needs it.
 *
 * The distinction between the two exports is the whole safety argument. Everything that
 * *creates* a client is already async and awaits `loadYouTubeI`. Everything that *parses* a
 * response runs downstream of one of those calls, so the module is guaranteed resident and
 * can read it synchronously — `requireYouTubeI` exists to make a violation of that ordering
 * throw immediately with a clear message, rather than surface as `undefined is not a
 * constructor` somewhere in a parser.
 */
export type YouTubeModule = typeof import("youtubei.js");

let cached: YouTubeModule | null = null;
let pending: Promise<YouTubeModule> | null = null;

export async function loadYouTubeI(): Promise<YouTubeModule> {
  if (cached) return cached;
  // Single-flight: several controllers ask for a client at once on startup, and each import()
  // would otherwise be a separate promise resolving to the same module.
  pending ??= import("youtubei.js").then((module) => {
    cached = module;
    return module;
  });
  return pending;
}

/** The module, or a loud failure. Only valid downstream of a `loadYouTubeI` await. */
export function requireYouTubeI(): YouTubeModule {
  if (!cached) {
    throw new Error(
      "youtubei.js was read before it finished loading — call loadYouTubeI() first.",
    );
  }
  return cached;
}
