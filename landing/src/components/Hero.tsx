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

/** What the app does, in the app's own register. Machine-ish, because the wordmark is. */
const SPECS = [
  ["tabs", "one queue each"],
  ["lyrics", "line-synced"],
  ["offline", "yours to keep"],
  ["local files", "in the same list"],
] as const;

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
    /*
     * Flat black and one red. No wash, no glass, no gradient text.
     *
     * The previous hero played a 43 MB video behind everything — the most expensive thing on
     * the page, downloaded in full before a word was read, and stock footage says nothing
     * about a music player. What replaced it is structure: hairline rules, a hard type block,
     * and the product itself bleeding off the right edge.
     */
    <section id="top" className="relative isolate w-full overflow-hidden bg-background">
      <Header />

      <div className="mx-auto w-full max-w-[1400px] px-6">
        <div className="grid items-end gap-x-12 gap-y-14 pb-0 pt-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:pt-20">
          <div className="flex flex-col items-start pb-16 lg:pb-24">
            <span className="flex items-baseline gap-px font-mono text-2xl font-medium tracking-tight text-foreground">
              zuno
              {/* The underscore, made literal. */}
              <span className="caret text-primary" aria-hidden="true">
                _
              </span>
            </span>

            {/*
              Three lines, one idea each, and the accent lands on the only word that is a
              claim. A gradient across the headline would have been decoration standing in
              for emphasis.
            */}
            <h1 className="mt-8 text-balance text-[clamp(46px,7.2vw,92px)] font-semibold leading-[0.88] tracking-[-0.06em] text-foreground">
              <span className="block">Your music.</span>
              <span className="block">Your machine.</span>
              <span className="block text-primary">No browser.</span>
            </h1>

            <p className="mt-8 max-w-[42ch] text-pretty text-lg leading-8 text-foreground/60">
              A desktop client for your own YouTube Music account — not a wrapped tab.
            </p>

            {/*
              A spec table rather than feature copy. The audience for a desktop music client
              reads a list faster than it reads prose, and this is the register the wordmark
              already set.
            */}
            <dl className="mt-10 grid w-full max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-0 border-t border-white/10">
              {SPECS.map(([term, detail]) => (
                <div key={term} className="col-span-2 grid grid-cols-subgrid border-b border-white/10 py-2.5">
                  <dt>
                    <Mono className="text-foreground/40">{term}</Mono>
                  </dt>
                  <dd className="text-sm text-foreground/85">{detail}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 flex flex-wrap items-center gap-3">
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
              <Mono className="text-foreground/35">
                {release ? `v${release.version}` : "apache-2.0"}
              </Mono>
            </div>
          </div>

          {/*
            Flush to the top and running off the right edge, with no card around it. A window
            floating in the middle of a page reads as a picture of an app; one cropped by the
            viewport reads as the app, continuing past what the page can show.
          */}
          <div className="relative self-stretch max-lg:-mx-6 lg:-mr-6 xl:-mr-24">
            <div className="relative h-full border-l border-t border-white/10 max-lg:border-x-0">
              <video
                className="aspect-video h-full w-full object-cover object-left-top"
                src={DEMO_VIDEO}
                poster="./zuno-d1-1.2.PNG"
                /* A looping video is exactly the continuous motion the preference exists to
                   stop, and no CSS rule can pause it — so it holds on the poster and offers
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
        </div>
      </div>

      {/* The one rule that spans the page, in the accent. Ends the hero on structure. */}
      <div className="h-px w-full bg-primary/60" aria-hidden="true" />
    </section>
  );
}
