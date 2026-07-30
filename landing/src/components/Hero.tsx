import { BrandIcon, OS_ICON } from "./brandIcons";
import { DownloadIcon } from "./icons";
import { Header } from "./Header";
import { LinkButton, Mono } from "./ui";
import { useReducedMotion } from "@/useReducedMotion";
import {
  GITHUB_REPO,
  RELEASES_URL,
  formatSize,
  type LatestRelease,
  type PlatformId,
} from "../releases";

const PLATFORM_LABEL: Record<PlatformId, string> = {
  windows: "Windows",
  "macos-arm": "macOS",
  "macos-intel": "macOS",
  linux: "Linux",
};

const DEMO_VIDEO = "https://pub-493a5d4ea10b45dcaa83917aa3856a32.r2.dev/zunodem.mp4";
/** Read off the file's own header. Declared so the box is reserved before a byte arrives. */
const DEMO_W = 1234;
const DEMO_H = 922;

/** The back cover. Numbered because a tracklist is numbered — six, which is one clean row. */
const TRACKS = [
  "tabs, one queue each",
  "line-synced lyrics",
  "offline downloads",
  "your local files",
  "discord presence",
  "last.fm scrobbling",
];

/**
 * The record sliding out of the sleeve.
 *
 * Grooves are one repeating radial gradient rather than a stack of ring elements, and the whole
 * disc is a single rotating box. Mostly hidden behind the jacket: what sells it is the arc
 * leaving the right edge, not the parts you would have to draw accurately.
 */
function Vinyl({ spinning }: { spinning: boolean }) {
  return (
    <div
      className={`absolute right-[-13%] top-1/2 z-0 hidden aspect-square w-[66%] -translate-y-1/2 rounded-full ring-1 ring-white/5 sm:block ${
        spinning ? "spin-slow" : ""
      }`}
      style={{
        background:
          "repeating-radial-gradient(circle at 50% 50%, oklch(0.19 0 0) 0 3px, oklch(0.14 0 0) 3px 7px)",
      }}
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-1/2 aspect-square w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
      <div className="absolute left-1/2 top-1/2 aspect-square w-[4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
    </div>
  );
}

/**
 * The hero, built as a record sleeve.
 *
 * Every desktop-app hero is the same picture: a floating window with a shadow under it. A
 * jacket is the object this product is actually about — so the footage is printed on the sleeve,
 * the catalogue metadata is set where a label prints it, the record itself leaves the frame on
 * the right, and the feature list is the tracklist on the back. The composition carries the
 * brand instead of a gradient having to.
 */
export function Hero({
  release,
  platform,
}: {
  release: LatestRelease | null;
  platform: PlatformId | null;
}) {
  const reducedMotion = useReducedMotion();
  const target = platform ?? "windows";
  const asset = release?.downloads[target];
  const label = platform ? PLATFORM_LABEL[platform] : "your system";

  return (
    <section
      id="top"
      className="relative isolate flex min-h-svh w-full flex-col overflow-hidden bg-background"
    >
      <Header />

      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-y-16 px-6 pb-14 pt-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:gap-x-16 lg:pb-20 lg:pt-8">
        <div className="flex flex-col items-start">
          {/* Set as a label prints it: the mark, the format, the pressing. */}
          <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-foreground/40">
            <span className="text-base normal-case tracking-tight text-foreground/75">
              zuno
              <span className="caret text-primary" aria-hidden="true">
                _
              </span>
            </span>
            <span className="h-3 w-px bg-white/15" aria-hidden="true" />
            <span>{release ? `v${release.version}` : "apache-2.0"}</span>
          </div>

          {/*
            The one claim no wrapped browser tab can make, set at poster scale. The accent lands
            on the noun that is the whole argument.
          */}
          <h1 className="mt-8 text-balance text-[clamp(50px,7.4vw,100px)] font-semibold leading-[0.86] tracking-[-0.065em] text-foreground">
            <span className="block">Every tab</span>
            <span className="block">
              a <span className="text-primary">queue</span>.
            </span>
          </h1>

          <p className="mt-8 max-w-[44ch] text-pretty text-lg leading-8 text-foreground/60">
            A desktop client for your own YouTube Music account. Not a wrapped tab — a real
            window, with your downloads and local files in the same list.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <LinkButton
              href={asset?.url ?? RELEASES_URL}
              rel="noopener"
              className="group rounded-full px-7 py-4 text-lg transition-transform duration-200 hover:-translate-y-0.5"
            >
              <DownloadIcon
                size={20}
                className="transition-transform duration-200 group-hover:translate-y-0.5"
              />
              Download for {label}
            </LinkButton>

            <LinkButton
              variant="muted"
              href={GITHUB_REPO}
              rel="noopener"
              className="rounded-full px-6 py-4 text-lg transition-transform duration-200 hover:-translate-y-0.5"
            >
              <BrandIcon icon={OS_ICON.github} width={19} height={19} />
              Source
            </LinkButton>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-3" aria-label="Windows, macOS and Linux">
              <BrandIcon icon={OS_ICON.windows} width={16} height={16} />
              <BrandIcon icon={OS_ICON.macos} width={16} height={16} className="text-foreground" />
              <BrandIcon icon={OS_ICON.linux} width={16} height={16} />
            </span>
            <Mono className="text-foreground/35">
              {asset ? `${formatSize(asset.size)} · signed` : "windows · macos · linux"}
            </Mono>
          </div>
        </div>

        <div className="relative w-full max-lg:mx-auto max-lg:max-w-2xl">
          <Vinyl spinning={!reducedMotion} />

          {/* The jacket: footage printed to the edges, then the label strip along the foot. */}
          <div className="relative z-10 bg-card/35 p-2 ring-1 ring-white/10 backdrop-blur-sm">
            <video
              className="block w-full"
              width={DEMO_W}
              height={DEMO_H}
              src={DEMO_VIDEO}
              poster="./zuno-d1-1.2.PNG"
              /* No CSS rule can pause a looping video, and a loop is precisely the continuous
                 motion the preference exists to stop — so it holds on the poster and hands over
                 controls instead. */
              autoPlay={!reducedMotion}
              controls={reducedMotion}
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Zuno playing a song, with the queue and synced lyrics open"
            />

            <div className="flex items-center justify-between gap-4 px-2 pb-1 pt-3 font-mono text-[11px] uppercase tracking-[0.24em] text-foreground/40">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                now playing
              </span>
              <span className="truncate">free &amp; open source</span>
            </div>
          </div>
        </div>
      </div>

      {/* Back cover. Static: the information is the point, and a marquee makes it unreadable. */}
      <ol className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-8 gap-y-3 border-t border-white/10 px-6 py-7 sm:grid-cols-3 lg:grid-cols-6">
        {TRACKS.map((track, i) => (
          <li key={track} className="flex items-baseline gap-2.5">
            <Mono className="text-foreground/25">{String(i + 1).padStart(2, "0")}</Mono>
            <span className="text-pretty text-sm leading-6 text-foreground/60">{track}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
