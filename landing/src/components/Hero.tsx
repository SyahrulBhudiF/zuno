import { BrandIcon, OS_ICON } from "./brandIcons";
import { DownloadIcon } from "./icons";
import { LinkButton, Mono } from "./ui";
import {
  GITHUB_REPO,
  RELEASES_URL,
  formatSize,
  type LatestRelease,
  type PlatformId,
} from "../releases";
import { Header } from "@/App";

const PLATFORM_LABEL: Record<PlatformId, string> = {
  windows: "Windows",
  "macos-arm": "macOS",
  "macos-intel": "macOS",
  linux: "Linux",
};

/**
 * Hero: footage behind, product in front.
 *
 * The previous version centred everything and put the screenshot in a separate section, which
 * meant the first screen argued for the app without ever showing it. Here the copy holds the
 * left column and a real window sits in the right, cropped by the viewport edge — the page
 * begins with evidence rather than a claim, and the crop implies there is more of it below.
 *
 * Three scrims, because a video is not a fixed background: any frame can be bright anywhere. A
 * top fade keeps the header legible, a flat wash stops copy landing on a blown-out frame, and a
 * bottom fade hands off to the page instead of ending on a cut. All are mixed from the theme
 * token rather than hardcoded black.
 */
export function Hero({
  release,
  platform,
}: {
  release: LatestRelease | null;
  platform: PlatformId | null;
}) {
  const target = platform ?? "windows";
  const asset = release?.downloads[target];
  const label = platform ? PLATFORM_LABEL[platform] : "your system";

  return (
    <section id="top" className="relative w-full overflow-hidden">
         <Header />
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src="./bgvid.mp4"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />

  
     
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-80"
        style={{
          background: "linear-gradient(0deg, var(--color-background) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-[2] mx-auto grid w-full max-w-[1400px] items-center gap-12 px-6 pb-24 pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8 lg:pb-32 lg:pt-40">
        <div className="flex flex-col items-start text-left max-lg:items-center max-lg:text-center">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full bg-background/50 px-3 py-1.5 ring-1 ring-border backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            <Mono className="text-foreground/80">
              {release ? `v${release.version} — out now` : "free · open source"}
            </Mono>
          </span>

          {/*
            Two beats, and the second one is the payoff.

            "Every tab keeps playing" asserts something the reader has to already care about to
            find remarkable. This stages it instead: an action, then the consequence — which is
            the same thing the demo further down the page does, and the reason the claim lands
            without a word of explanation. The muted second line is the punchline, so it reads
            as the answer to the first rather than a continuation of it.
          */}
          <h1 className="mb-6 max-w-[16ch] text-balance text-[clamp(46px,6vw,80px)] font-semibold leading-[0.98] tracking-[-0.045em] text-foreground">
            Open a second tab.
            <br />
            <span className="text-foreground/50">The first keeps playing.</span>
          </h1>

          <p className="mb-9 max-w-[46ch] text-pretty text-xl leading-relaxed text-foreground/70">
            A desktop client for your own YouTube Music account — every tab with its own queue.
            Offline downloads, synced lyrics, a mini player, and your local files in the same list.
          </p>

          <div className="mb-6 flex flex-wrap items-center gap-3 max-lg:justify-center">
            <LinkButton
              href={asset?.url ?? RELEASES_URL}
              rel="noopener"
              className="px-7 py-4 text-lg"
            >
              <DownloadIcon size={20} />
              Download for {label}
            </LinkButton>

            <LinkButton
              variant="outline"
              href={GITHUB_REPO}
              rel="noopener"
              className="px-6 py-4 text-lg"
            >
              <BrandIcon icon={OS_ICON.github} width={19} height={19} />
              Source
            </LinkButton>
          </div>

          {/* Availability as marks rather than a sentence — read at a glance, in any language. */}
          <div className="flex items-center gap-4 max-lg:justify-center">
            <span className="flex items-center gap-3" aria-label="Available for Windows, macOS and Linux">
              <BrandIcon icon={OS_ICON.windows} width={19} height={19} />
              <BrandIcon icon={OS_ICON.macos} width={19} height={19} className="text-foreground" />
              <BrandIcon icon={OS_ICON.linux} width={19} height={19} />
            </span>
            <Mono className="text-foreground/50">
              {asset ? `${formatSize(asset.size)} · signed` : "Windows · macOS · Linux"}
            </Mono>
          </div>
        </div>

        {/*
          The window is pushed past the right edge on wide screens. A fully contained screenshot
          reads as a picture of the app; one that runs out of the frame reads as the app itself,
          continuing beyond what the page can show.
        */}
        <div className="relative max-lg:mx-auto max-lg:max-w-2xl lg:-mr-24 xl:-mr-40">
          <div className="overflow-hidden rounded-2xl bg-[#141414] shadow-2xl ring-1 ring-white/10">
        
            <img
              className="w-full"
              src="./screenshot-dark.png"
              alt="Zuno's home view, with a playlist rail on the left and the player bar along the bottom"
              width={1920}
              height={1239}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
