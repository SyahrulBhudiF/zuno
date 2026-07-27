import type { AnchorHTMLAttributes, ReactNode } from "react";

/**
 * Class merger.
 *
 * The app uses clsx + tailwind-merge, which exist there because components take a `className`
 * override and have to resolve conflicts. Nothing on this page does, so a join is the whole
 * requirement — two dependencies for a filter would not earn their place.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Two buttons, not five.
 *
 * A landing page has one thing it wants you to do. Every additional button weight is another
 * claim on that attention, so there is the action and there is everything else.
 */
const SOLID =
  "group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-base font-medium text-background transition-[transform,opacity] hover:-translate-y-px hover:opacity-90 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const QUIET =
  "inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/*
 * A third weight, for actions sitting on top of the video.
 *
 * Neither of the other two work there: the solid fill is reserved for the one primary action,
 * and the quiet variant has no surface, so its label competes with whatever frame the footage
 * happens to be on. A blurred translucent pill stays legible over anything moving underneath.
 */
const OUTLINE =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-base font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

/* Secondary weight on an opaque surface — the outline variant is tuned for video, not cards. */
const MUTED =
  "inline-flex items-center justify-center gap-2 rounded-full bg-background/70 px-5 py-2.5 text-base font-medium text-foreground ring-1 ring-border transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const VARIANTS = { solid: SOLID, quiet: QUIET, outline: OUTLINE, muted: MUTED } as const;
export type ButtonVariant = keyof typeof VARIANTS;

export function LinkButton({
  variant = "solid",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant }) {
  return <a className={cn(VARIANTS[variant], className)} {...props} />;
}

/** Small monospace label. Used for versions, sizes, counts — anything machine-ish. */
export function Mono({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("font-mono text-[13px] tracking-tight text-muted-foreground", className)}>
      {children}
    </span>
  );
}

/**
 * Section shell.
 *
 * Everything is on one measure and left-aligned. Centred columns read as a template; a single
 * consistent left edge running the length of the page is what makes it read as designed.
 */
export function Section({
  id,
  index,
  title,
  lede,
  children,
}: {
  id?: string;
  /** Two-digit marker in the margin — the page reads as a numbered document. */
  index?: string;
  title?: string;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="reveal">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
          <Mono className="shrink-0 pt-1.5 sm:w-16">{index}</Mono>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <h2 className="max-w-2xl text-pretty text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl">
              {title}
            </h2>
            {lede ? (
              <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {lede}
              </p>
            ) : null}
            {children ? <div className="mt-6">{children}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
