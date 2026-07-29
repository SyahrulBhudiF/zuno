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
function Character() {
  return (
    <video
      className="size-14 shrink-0 rounded-full bg-card/40 object-cover"
      src="./zuno-character.mp4"
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
    />
  );
}
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
    <section id="top" className="relative w-full overflow-hidden bg-muted">


<Header/>
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: "color-mix(in oklab, var(--color-background) 35%, transparent)" }}
        aria-hidden="true"
      />
         <video
        className="absolute inset-0 z-0 h-full w-full object-cover "
        src="./bgvids.mp4"
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

      <div className="relative z-[2] mx-auto grid w-full max-w-[1500px] items-center gap-12 px-2 pb-24 pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8 lg:pb-32 lg:pt-40">

        
      <div className="flex flex-col items-start text-left max-lg:items-center max-lg:text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/45 px-3.5 py-1.5 text-sm backdrop-blur-xl">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            <Mono className="text-foreground/80">
              {release ? `v${release.version} — out now` : "free · open source"}
            </Mono>
          </span>

          <div className="max-w-4xl">
           <div className="flex items-center text-4xl font-bold gap-2 p-2 bg-black w-fit rounded-full pr-6 "><Character/>zuno_</div> 

            <h1 className="max-w-[12ch] text-balance text-[clamp(42px,8vw,80px)] font-semibold leading-[0.9] tracking-[-0.065em] text-foreground">
              <span className="block">The desktop app</span>

              <span className="mt-3 inline-flex flex-wrap items-center align-middle justify-center gap-3">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-1 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl align-middle items-center">
                  <img
                    src="./images.png"
                    alt="YouTube Music"
                    className="h-10 w-auto md:h-16 rounded-full"
                  />
                </span>
                <span>deserves</span>
              </span>
            </h1>

            <p className="mt-7 max-w-[46ch] text-pretty text-lg leading-8 text-foreground/68 md:text-xl">
              A desktop client for your own YouTube Music account. Tabs that each hold
              their own queue, offline downloads, synced lyrics, and your local files in
              the same list.
            </p>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3 max-lg:justify-center">
            <LinkButton
              href={asset?.url ?? RELEASES_URL}
              rel="noopener"
              className="group rounded-full px-7 py-4 text-lg shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
            >
              <DownloadIcon size={20} className="transition-transform duration-200 group-hover:translate-y-0.5" />
              Download for {label}
            </LinkButton>

            <LinkButton
              variant="outline"
              href={GITHUB_REPO}
              rel="noopener"
              className="rounded-full px-6 py-4 text-lg backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5"
            >
              <BrandIcon icon={OS_ICON.github} width={19} height={19} />
              Source
            </LinkButton>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 max-lg:justify-center">
            <span
              className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl"
              aria-label="Available for Windows, macOS and Linux"
            >
              <BrandIcon icon={OS_ICON.windows} width={18} height={18} />
              <BrandIcon icon={OS_ICON.macos} width={18} height={18} className="text-foreground" />
              <BrandIcon icon={OS_ICON.linux} width={18} height={18} />
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
        <div className="relative max-lg:mx-auto max-lg:max-w-2xl lg:-mr-14 xl:-mr-40">
          <div className="overflow-hidden rounded-2xl bg-[#141414] shadow-2xl ring-1 ring-white/10">
            {/* Intrinsic size, not the old 1920x1209 the previous shot never had: a wrong
                ratio reserves the wrong box and the hero jumps once the image decodes. */}
            <img
              className="w-full"
              src="./zuno-d1-1.2.PNG"
              alt="Zuno's home view, with a playlist rail on the left and the player bar along the bottom"
              width={1405}
              height={1014}
              fetchPriority="high"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
