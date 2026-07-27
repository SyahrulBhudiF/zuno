import { useEffect, useState } from "react";
import { useLatestRelease } from "@/useLatestRelease";
import { Downloads } from "@/components/Downloads";
import { Hero } from "@/components/Hero";
import { LinkButton, Mono, Section, cn } from "./components/ui";
import { GITHUB_REPO, RELEASES_URL } from "./releases";

/**
 * One header for the whole page.
 *
 * Transparent while the hero is behind it — the nav is meant to sit *on* the footage, and a bar
 * with its own fill there reads as a second surface stacked on the first. It takes a background
 * only once the hero has scrolled past and there is content underneath to separate itself from.
 */
export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-200 bg-transparent"

      )}
    >
      <div className={cn(
        "sticky top-0 z-50 max-w-3xl transition-colors duration-200 bg-background/80",
        scrolled && "bg-transparent backdrop-blur-md","mx-auto flex h-16    items-center gap-3 px-3 mt-2 border border-border rounded-3xl"
      )}>
        <a className="flex items-center gap-2 text-2xl font-bold text-foreground" href="#top">
          <img className="size-10" src="./logo.png" alt="" />
          zuno_
        </a>

   {/*      <nav className="ml-8 hidden items-center gap-5 sm:flex" aria-label="Sections">
          {[
          
            ["download", "#download"],
          ].map(([label, href]) => (
            <a
              key={href}
              className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              href={href}
            >
              {label}
            </a>
          ))}
        </nav> */}

        <div className="ml-auto flex items-center gap-2">
       {/*    <a
            className="grid size-9 place-items-center rounded-full text-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={GITHUB_REPO}
            rel="noopener"
            aria-label="Zuno on GitHub"
          >
            <BrandIcon icon={OS_ICON.github} width={17} height={17} className="text-foreground" />
          </a> */}
          <LinkButton href="#download" className="px-4 py-2 text-sm">
            Download
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

/**
 * The Zuno character, looping.
 *
 * The one place with room for personality — everything else on the page is doing a job. Muted,
 * looping and `playsInline` so it behaves like a graphic rather than media: no controls, nothing
 * to pause, and it never asks for sound.
 */
function Character() {
  return (
    <video
      className="size-16 shrink-0 rounded-2xl bg-card/40 object-cover"
      src="./zuno-character.mp4"
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
    />
  );
}

function Footer() {
  return (
    <footer className=" bg-black">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-14 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <Character />
          <div className="flex max-w-sm flex-col gap-2">
            <span className="flex items-center gap-2 text-base font-bold text-foreground">
              <img className="size-5" src="./logo.png" alt="" />
              zuno_
            </span>
            <Mono className="leading-relaxed">
              an independent, unofficial project. not affiliated with, authorised by or endorsed
              by youtube or google.
            </Mono>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-5" aria-label="Links">
          {[
            ["github", GITHUB_REPO],
            ["releases", RELEASES_URL],
            ["issues", `${GITHUB_REPO}/issues`],
            ["licence", `${GITHUB_REPO}/blob/main/LICENSE`],
          ].map(([label, href]) => (
            <a
              key={href}
              className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              href={href}
              rel="noopener"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function App() {
  const latest = useLatestRelease();

  return (
    <div className="flex min-h-screen flex-col">
   
      <main className="flex-1">
        
        <Hero release={latest.release} platform={latest.platform} />
{/* 
        <Section
          id="features"
          index="01"
          title="A real app, not a wrapped tab"
          lede="Pick a feature to see it. Everything here is the actual interface, not a mock-up of one."
        >
          <Features />
        </Section> */}

        <Section
          id="download"
           
     
          lede="Free and open source. Pick your system — the format choice inside each tile is the only decision to make."
        >
          <Downloads release={latest.release} platform={latest.platform} />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
