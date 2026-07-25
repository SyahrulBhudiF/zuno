import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Distance between the trigger's right edge and the panel. */
const GAP = 10;
/** Keeps the panel off the window edge when the trigger sits low. */
const VIEWPORT_MARGIN = 12;

interface RailPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens the panel. Rendered in place, in normal flow. */
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A popover for the collapsed sidebar rail, opening to its right.
 *
 * The panel is portalled to `document.body` and positioned `fixed` from the trigger's
 * measured rect. That is the whole point of this component: the rail is 72px wide and sits
 * inside two nested `overflow-hidden` shells (the window root, which cuts the rounded
 * corners, and the layout row). Any panel positioned *within* the rail is therefore either
 * clipped by those shells or painted over by the content column, which is a later sibling
 * with its own opaque background. Portalling side-steps both by construction, rather than
 * by finding a z-index that happens to win today.
 *
 * Position is recomputed on scroll and resize because `fixed` coordinates are frozen at
 * paint time — without it the panel would detach from its trigger.
 */
export function RailPopover({
  open,
  onOpenChange,
  trigger,
  children,
  className,
}: RailPopoverProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const maxTop = window.innerHeight - panelHeight - VIEWPORT_MARGIN;
      setPosition({
        left: anchor.right + GAP,
        top: Math.max(VIEWPORT_MARGIN, Math.min(anchor.top, maxTop)),
      });
    };

    place();
    // `capture` so it also fires for the app's inner scroll containers, which do not bubble.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onOpenChange]);

  return (
    <>
      {/*
        A real layout box, not `display: contents`: contents elements generate no box, so
        getBoundingClientRect() returns zeros and the panel would anchor to the window corner
        instead of the button. `flex flex-col` keeps it transparent to the rail's own layout.
      */}
      <div ref={triggerRef} className="flex flex-col">
        {trigger}
      </div>

      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="false"
              initial={{ opacity: 0, scale: 0.94, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.96, x: -4, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.6 }}
              style={{ position: "fixed", left: position.left, top: position.top }}
              className={cn(
                "z-[100] origin-left rounded-2xl bg-popover p-3 text-popover-foreground",
                "shadow-2xl ring-1 ring-border",
                className,
              )}
            >
              {children}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
