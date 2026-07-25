import { useEffect, useState } from "react";
import { CloseIcon, KeyIcon } from "@/ui/icons";
import { primaryModifierLabel } from "../platform";

export type OnboardingStep =
  | "open-search"
  | "type-first"
  | "play-first"
  | "new-tab"
  | "type-second"
  | "play-second"
  | "switch-back";

function getStepContent(): Record<
  OnboardingStep,
  { text: string; target: string; shortcut?: string }
> {
  return {
    "open-search": {
      text: `Press ${primaryModifierLabel} Space, or click the search bar.`,
      target: '[data-onboarding="search"]',
      shortcut: `${primaryModifierLabel} Space`,
    },
    "type-first": {
      text: "Enter one of your favorite songs.",
      target: '[data-onboarding="search-panel"]',
      shortcut: `${primaryModifierLabel} Space`,
    },
    "play-first": {
      text: "Play the song.",
      target: '[data-onboarding="search-panel"], [data-onboarding="search-results"]',
    },
    "new-tab": {
      text: "Open a new tab to keep this song playing here.",
      target: '[data-onboarding="new-tab"]',
      shortcut: `${primaryModifierLabel} T`,
    },
    "type-second": {
      text: "Search for another song in this new tab.",
      target: '[data-onboarding="search-panel"]',
      shortcut: `${primaryModifierLabel} Space`,
    },
    "play-second": {
      text: "Play it. This tab now has its own music.",
      target: '[data-onboarding="search-panel"], [data-onboarding="search-results"]',
    },
    "switch-back": {
      text: "Switch back. Your first song is still in its tab.",
      target: '[data-onboarding="first-tab"]',
      shortcut: `${primaryModifierLabel} 1, 2, 3...`,
    },
  };
}

interface OnboardingProps {
  step: OnboardingStep;
  onSkip: () => void;
}

export function Onboarding({ step, onSkip }: OnboardingProps) {
  const [typedText, setTypedText] = useState("");
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const content = getStepContent()[step];
  const padding = 8;
  const left = targetRect ? Math.max(0, targetRect.left - padding) : 0;
  const top = targetRect ? Math.max(0, targetRect.top - padding) : 0;
  const right = targetRect
    ? Math.min(window.innerWidth, targetRect.right + padding)
    : 0;
  const bottom = targetRect
    ? Math.min(window.innerHeight, targetRect.bottom + padding)
    : 0;

  useEffect(() => {
    setTypedText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedText(content.text.slice(0, index));
      if (index >= content.text.length) window.clearInterval(timer);
    }, 22);
    return () => window.clearInterval(timer);
  }, [content.text]);

  useEffect(() => {
    const updateTarget = () => {
      const target = document.querySelector<HTMLElement>(content.target);
      setTargetRect(target?.getBoundingClientRect() ?? null);
    };
    updateTarget();
    const timer = window.setInterval(updateTarget, 120);
    window.addEventListener("resize", updateTarget);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", updateTarget);
    };
  }, [content.target]);

  return (
    <div className="fixed inset-0 z-[90]" aria-live="polite">
      {targetRect && (
        <>
          <div className="absolute inset-x-0 top-0 bg-background/75 backdrop-blur-[2px]" style={{ height: top }} />
          <div
            className="absolute left-0 bg-background/75 backdrop-blur-[2px]"
            style={{
              top,
              width: left,
              height: bottom - top,
            }}
          />
          <div
            className="absolute right-0 bg-background/75 backdrop-blur-[2px]"
            style={{
              top,
              left: right,
              height: bottom - top,
            }}
          />
          <div className="absolute inset-x-0 bottom-0 bg-background/75 backdrop-blur-[2px]" style={{ top: bottom }} />
          <div
            className="absolute rounded-xl shadow-[0_0_0_9999px_transparent,0_0_40px_var(--color-primary)]"
            style={{
              left,
              top,
              width: right - left,
              height: bottom - top,
            }}
          />
          <div
            className="absolute rounded-xl ring-2 ring-primary"
            style={{
              left,
              top,
              width: right - left,
              height: bottom - top,
            }}
          />
        </>
      )}
      <button
        className="self-start text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        onClick={onSkip}
        aria-label="Skip onboarding"
        title="Skip onboarding"
      >
        <span>Close onboarding</span>
        <CloseIcon size={19} />
      </button>
      <div className="absolute flex max-w-xs flex-col gap-2 rounded-xl bg-popover p-4 text-sm text-foreground shadow-2xl">
        {step === "open-search" && <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick start</span>}
        <p>{typedText}<span className="absolute size-3 rotate-45 bg-popover" /></p>
        {content.shortcut && <kbd className="rounded bg-card px-1.5 py-0.5 font-sans text-xs text-muted-foreground">{content.shortcut}</kbd>}
      </div>
    </div>
  );
}

export function OnboardingCompleteToast() {
  return (
    <div className="fixed bottom-28 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-2 rounded-full bg-popover/95 px-4 py-2 shadow-2xl backdrop-blur" role="status">
      <span className="text-sm text-foreground">Onboarding</span>
      <strong>Complete</strong>
    </div>
  );
}

export function OnboardingWelcome() {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-background" role="status" aria-label="Welcome">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <strong>Welcome</strong>
      </div>
    </div>
  );
}

interface KeychainNoticeProps {
  onContinue: () => void;
}

export function KeychainNotice({ onContinue }: KeychainNoticeProps) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-background/80 backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="keychain-title">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
      <div className="relative flex w-[min(28rem,90vw)] flex-col items-center gap-3 rounded-2xl bg-popover p-6 text-center shadow-2xl">
        <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
          <KeyIcon size={28} />
        </span>
        <h1 id="keychain-title">A note about macOS Keychain</h1>
        <p>
          This Client uses Keychain to protect the encryption key for your
          YouTube Music session cookie. macOS may ask for permission when you continue.
        </p>
        <p>
          The app only accesses the Keychain item it created for this purpose. It does not
          request access to your passwords or any other Keychain items. You can also deny this but signing in with YT Music will not work then!
        </p>
        <p>
          <strong>
            If you want for the popup to go away click "always allow"
          </strong>

        </p>
        <button type="button" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
