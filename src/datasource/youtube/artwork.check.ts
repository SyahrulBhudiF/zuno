/**
 * Self-check for artwork selection. No test runner in this project, so:
 *
 *   npx esbuild src/datasource/youtube/artwork.check.ts --bundle --platform=node --format=esm
 *     --outfile=check.mjs && node check.mjs
 *
 * Selection is "biggest wins", which only stays right as long as the caller hands it one kind
 * of image at a time — an artist's portrait and their page banner are picked between by field,
 * not by size, precisely because the banner would win here every time.
 */
export {};

import { getArtworkUrlCandidates, selectArtworkUrl } from "./artwork";

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
}

const large = { url: "https://example.com/large", width: 1000, height: 1000 };
const small = { url: "https://example.com/small", width: 120, height: 120 };
const sizeless = { url: "https://example.com/sizeless" };

check(selectArtworkUrl([small, large]) === large.url, "the largest image wins");
check(selectArtworkUrl([large, sizeless]) === large.url, "a sized image beats an unsized one");
check(selectArtworkUrl([sizeless]) === sizeless.url, "an unsized image is still an image");
check(selectArtworkUrl([]) === undefined, "nothing in, nothing out");
check(
  selectArtworkUrl(null, undefined, [small]) === small.url,
  "missing groups are skipped rather than throwing",
);
check(
  selectArtworkUrl([{ url: "  " }, small]) === small.url,
  "a blank url is not a candidate",
);
check(
  selectArtworkUrl([{ url: "//example.com/img", width: 10, height: 10 }])
    === "https://example.com/img",
  "protocol-relative urls are normalised",
);

// Size variants: the original is always tried first, so a rewrite can never lose the image.
const variants = getArtworkUrlCandidates("https://yt3.googleusercontent.com/abc=w2565-h1068-l90-rj");
check(
  variants[0] === "https://yt3.googleusercontent.com/abc=w2565-h1068-l90-rj",
  "the original url is the first candidate",
);
check(variants.length > 1, "youtube urls get smaller variants to fall back on");
check(
  getArtworkUrlCandidates("https://example.com/img.jpg").length === 1,
  "urls on other hosts have no size syntax to rewrite",
);
check(getArtworkUrlCandidates("").length === 0, "no url, no candidates");

console.log("artwork.check.ts OK");
