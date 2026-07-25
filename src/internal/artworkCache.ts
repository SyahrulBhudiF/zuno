/**
 * Remembers which artwork URL actually loaded, per source URL.
 *
 * Artwork is served from several candidate URLs (the original, plus resized YouTube
 * variants) and falls back to fetching the bytes through Rust when the webview cannot load
 * the image directly. Without this cache every mount restarts that walk from the top: a
 * playlist scrolled twice re-requests every failing candidate again, and the proxied blobs
 * were being revoked on unmount, so they were re-downloaded in full.
 *
 * The cache is keyed by the *source* URL the app was given, and stores whatever finally
 * worked, so a remount paints from the resolved URL on the first frame.
 *
 * Bounded because the values can be object URLs holding decoded image bytes. Insertion
 * order gives LRU for free: reading re-inserts, so eviction takes the coldest entry, and
 * only then is an object URL revoked.
 */
const MAX_ENTRIES = 500;

const resolved = new Map<string, string>();
/** Values that own a blob and must be revoked when evicted. */
const ownedObjectUrls = new Set<string>();

export function getResolvedArtworkUrl(sourceUrl: string): string | undefined {
  const hit = resolved.get(sourceUrl);
  if (hit === undefined) return undefined;

  // Re-insert so this entry becomes the most recently used.
  resolved.delete(sourceUrl);
  resolved.set(sourceUrl, hit);
  return hit;
}

export function rememberResolvedArtworkUrl(
  sourceUrl: string,
  workingUrl: string,
  options: { ownsObjectUrl?: boolean } = {},
): void {
  const previous = resolved.get(sourceUrl);
  if (previous === workingUrl) return;
  if (previous !== undefined) releaseValue(previous);

  resolved.delete(sourceUrl);
  resolved.set(sourceUrl, workingUrl);
  if (options.ownsObjectUrl) ownedObjectUrls.add(workingUrl);

  while (resolved.size > MAX_ENTRIES) {
    const oldestKey = resolved.keys().next().value;
    if (oldestKey === undefined) break;
    const oldestValue = resolved.get(oldestKey);
    resolved.delete(oldestKey);
    if (oldestValue !== undefined) releaseValue(oldestValue);
  }
}

function releaseValue(value: string): void {
  if (!ownedObjectUrls.has(value)) return;
  ownedObjectUrls.delete(value);
  URL.revokeObjectURL(value);
}

/** Used when clearing app data, so stale blobs do not outlive a cache reset. */
export function clearArtworkCache(): void {
  for (const value of resolved.values()) releaseValue(value);
  resolved.clear();
}
