import { Mono } from "./ui";

/** Every shot is a real 1405×1014 capture — declared so the grid reserves the right boxes. */
const SHOT_WIDTH = 1405;
const SHOT_HEIGHT = 1014;

const SHOTS = [
  {
    src: "./zuno-d-1.2.PNG",
    caption: "Synced lyrics",
    alt: "Synced lyrics following the current line, with the queue open alongside",
  },
  {
    src: "./zuno-l5-1.2.PNG",
    caption: "Your library",
    alt: "The library songs list showing liked, downloaded and explicit markers",
  },
  {
    src: "./zuno-l4-1.2.PNG",
    caption: "Light theme",
    alt: "The home view in light theme, with recommendations and recently played",
  },
] as const;

/**
 * Product shots below the hero.
 *
 * The hero shows one screen; a visitor deciding whether to download wants to see whether the
 * rest holds up. Three is the useful number — enough to show range, few enough that each is
 * still worth looking at.
 *
 * Loaded lazily and decoded off the main thread: these sit below the fold and are the heaviest
 * thing on the page, so they must not compete with the hero image for bandwidth.
 */
export function Screenshots() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {SHOTS.map((shot) => (
        <figure key={shot.src} className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-xl bg-[#141414] shadow-xl ring-1 ring-white/10">
            <img
              className="w-full"
              src={shot.src}
              alt={shot.alt}
              width={SHOT_WIDTH}
              height={SHOT_HEIGHT}
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption>
            <Mono>{shot.caption}</Mono>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
