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

/** What runs along the foot of the hero. Short enough to read at a glance, in passing. */
const TICKER = [
  "tabs, one queue each",
  "line-synced lyrics",
  "offline downloads",
  "your local files",
  "discord presence",
  "last.fm scrobbling",
  "mini player",
  "light & dark",
];

/**
 * The strip along the bottom edge.
 *
 * Duplicated because a seamless loop needs two copies: the track translates by exactly half
 * its own width, at which point the second copy sits precisely where the first began. The
 * duplicate is hidden from assistive tech so the list is announced once.
 */
function Ticker() {
  const run = (hidden: boolean) => (
    <ul
      className="flex shrink-0 items-center"
      aria-hidden={hidden || undefined}
    >
      {TICKER.map((item) => (
        <li key={item} className="flex items-center whitespace-nowrap">
          <span className="px-6 font-mono text-sm text-foreground/45">{item}</span>
          <span className="size-1 rounded-full bg-primary" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="relative flex overflow-hidden border-y border-white/10 py-4">
      <div className="ticker-track flex min-w-max">
        {run(false)}
        {run(true)}
      </div>
      {/* Fades the strip into the page rather than cutting it at the viewport edge. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-24"
        style={{ background: "linear-gradient(90deg, var(--color-background), transparent)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-24"
        style={{ background: "linear-gradient(270deg, var(--color-background), transparent)" }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * The hero, built as a poster.
 *
 * One composition carrying the whole first screen: the claim set large at the top left, the
 * product running off the right edge at full bleed, a metadata rail turned on its side down
 * the left margin, and a ticker closing the bottom. Layering and negative space do the work
 * that a card, a shadow and a gradient would otherwise be asked to fake.
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
    <section id="top" className="relative isolate flex min-h-svh w-full flex-col bg-background">
      <Header />

      {/*
        Turned on its side in the left margin. It only exists where there is margin to spare —
        below xl the space belongs to the content, and metadata is the first thing to go.
      */}
      <div
        className="pointer-events-none absolute left-6 top-1/2 hidden -translate-y-1/2 xl:block"
        aria-hidden="true"
      >
        <div className="flex items-center gap-4 [writing-mode:vertical-rl] [transform:rotate(180deg)]">
          <Mono className="tracking-[0.3em] text-foreground/30">
            {release ? `v${release.version}` : "apache-2.0"}
          </Mono>
          <span className="h-16 w-px bg-white/15" />
          <Mono className="tracking-[0.3em] text-foreground/30">free & open source</Mono>
        </div>
      </div>

      <div className="grid flex-1 items-center gap-y-12 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-x-10 lg:pt-6">
        <div className="flex flex-col items-start px-6 lg:pl-[max(1.5rem,calc((100vw-72rem)/2))] lg:pr-0 xl:pl-[max(5rem,calc((100vw-72rem)/2))]">
          <span className="flex items-baseline gap-px font-mono text-xl font-medium tracking-tight text-foreground/70">
            zuno
            <span className="caret text-primary" aria-hidden="true">
              _
            </span>
          </span>

          {/*
            Set as large as the measure allows and tracked in hard, so it reads as a poster
            rather than a paragraph with a big font size. The accent lands on the one line
            that is an argument; the other two are statements of fact.
          */}
          <h1 className="mt-7 text-balance text-[clamp(52px,7.6vw,104px)] font-semibold leading-[0.85] tracking-[-0.065em] text-foreground">
            <span className="block">Your music.</span>
            <span className="block">Your machine.</span>
            <span className="block text-primary">No browser.</span>
          </h1>

          <p className="mt-8 max-w-[40ch] text-pretty text-lg leading-8 text-foreground/60">
            A desktop client for your own YouTube Music account — not a wrapped tab.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <LinkButton
              href={asset?.url ?? RELEASES_URL}
              rel="noopener"
              className="group rounded-none px-7 py-4 text-lg transition-transform duration-200 hover:-translate-y-0.5"
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
              className="rounded-none px-6 py-4 text-lg transition-transform duration-200 hover:-translate-y-0.5"
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

        {/*
          Full bleed to the right edge, and nothing drawn around it. A window floated in the
          middle of a page is a picture of an app; one the page cannot contain is the app.
        */}
        <div className="relative w-full lg:pl-px">
          <div className="absolute inset-y-0 left-0 hidden w-px bg-white/10 lg:block" aria-hidden="true" />
          <video
            className="aspect-[1234/922] w-full"
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
        </div>
      </div>

      <Ticker />
    </section>
  );
}
