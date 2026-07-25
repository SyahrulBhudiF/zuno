import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CloseIcon, PlaylistIcon, TrashIcon } from "@/ui/icons";
import { usePlayerSession, playerController } from "../../../player/playerStore";
import { ArtistLinks } from "../ArtistLinks";

interface QueuePanelProps {
  /** Open/close animation now lives in Layout's AnimatePresence wrapper. */
  isOpen?: boolean;
  onClose: () => void;
}

export function QueuePanel({ onClose }: QueuePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const draggedElementRef = useRef<HTMLElement | null>(null);
  const captureElementRef = useRef<HTMLElement | null>(null);
  const pointerDragRef = useRef<{
    pointerId: number;
    sourceIndex: number;
    section: "manual" | "automatic";
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    insertAfter: boolean;
  } | null>(null);
  const playerSession = usePlayerSession();
  const queue = playerSession?.queue ?? [];
  const queueIndex = playerSession?.queueIndex ?? -1;
  const manualQueueLength = playerSession?.manualQueueLength ?? 0;
  const upcomingStartIndex = Math.max(queueIndex + 1, 0);
  const upcoming = queue.slice(upcomingStartIndex);
  const manualQueue = upcoming.slice(0, manualQueueLength);
  const autoQueue = upcoming.slice(manualQueueLength);

  const handleRemove = (offset: number) => {
    playerController.removeFromQueueAt(upcomingStartIndex + offset);
  };

  const handlePlay = (offset: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    void playerController.playQueueTrackAt(upcomingStartIndex + offset);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (!drag.isDragging) {
        const distance = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        );
        if (distance < 6) return;
        drag.isDragging = true;
        setDraggedIndex(drag.sourceIndex);
      }

      event.preventDefault();
      const translationY = event.clientY - drag.startY;
      draggedElementRef.current?.style.setProperty(
        "--drag-translation",
        `${translationY}px`,
      );

      const items = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>("[data-queue-index]") ?? [],
      ).filter((item) =>
        Number(item.dataset.queueIndex) !== drag.sourceIndex
        && item.dataset.queueSection === drag.section,
      );

      if (items.length === 0) {
        setDropTarget(null);
        return;
      }

      let targetElement = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>("[data-queue-index]"))
        .find((item) =>
          Boolean(item)
          && Number(item?.dataset.queueIndex) !== drag.sourceIndex
          && item?.dataset.queueSection === drag.section,
        ) ?? null;

      const panelBounds = panelRef.current?.getBoundingClientRect();
      if (panelBounds && event.clientY < panelBounds.top) {
        targetElement = items[0];
      } else if (panelBounds && event.clientY > panelBounds.bottom) {
        targetElement = items[items.length - 1];
      } else if (!targetElement) {
        targetElement = items.reduce<HTMLElement | null>((closest, item) => {
          if (!closest) return item;
          const itemCenter = item.getBoundingClientRect().top
            + item.getBoundingClientRect().height / 2;
          const closestCenter = closest.getBoundingClientRect().top
            + closest.getBoundingClientRect().height / 2;
          return Math.abs(itemCenter - event.clientY)
            < Math.abs(closestCenter - event.clientY)
            ? item
            : closest;
        }, null);
      }

      if (!targetElement) {
        setDropTarget(null);
        return;
      }

      const targetIndex = Number(targetElement.dataset.queueIndex);
      const bounds = targetElement.getBoundingClientRect();
      setDropTarget({
        index: targetIndex,
        insertAfter: event.clientY >= bounds.top + bounds.height / 2,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (
        drag.isDragging
        && dropTarget
        && dropTarget.index !== drag.sourceIndex
      ) {
        playerController.moveQueueTrack(
          drag.sourceIndex,
          dropTarget.index,
          dropTarget.insertAfter,
        );
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      pointerDragRef.current = null;
      draggedElementRef.current?.style.removeProperty("--drag-translation");
      draggedElementRef.current?.style.removeProperty("will-change");
      captureElementRef.current?.releasePointerCapture?.(event.pointerId);
      draggedElementRef.current = null;
      captureElementRef.current = null;
      setDraggedIndex(null);
      setDropTarget(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dropTarget]);

  const handleTrackPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    absoluteIndex: number,
    section: "manual" | "automatic",
  ) => {
    if (event.button !== 0) return;
    const trackItem = event.currentTarget.closest<HTMLElement>("[data-queue-index]");
    if (!trackItem) return;

    pointerDragRef.current = {
      pointerId: event.pointerId,
      sourceIndex: absoluteIndex,
      section,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
    };
    draggedElementRef.current = trackItem;
    captureElementRef.current = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
    trackItem.style.willChange = "transform";
  };

  const getTrackItemClassName = (absoluteIndex: number) => cn(
    "group/queue-item relative flex items-center gap-1 rounded-lg transition-colors hover:bg-card",
    // handlePointerMove writes --drag-translation; this is what renders the lift.
    "[transform:translateY(var(--drag-translation,0px))]",
    draggedIndex !== null && "select-none",
    draggedIndex === absoluteIndex && "opacity-40",
    dropTarget?.index === absoluteIndex && !dropTarget.insertAfter &&
      "before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded-full before:bg-primary",
    dropTarget?.index === absoluteIndex && dropTarget.insertAfter &&
      "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
  );

  return (
    <aside
      ref={panelRef}
      className="flex h-full flex-col overflow-y-auto overscroll-contain"
      aria-label="Queue panel"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between bg-card/80 px-3 py-2.5 backdrop-blur">
        <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">QUEUE</h2>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
          aria-label="Close queue panel"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">No queued songs.</p>
      ) : (
        <>
          {manualQueue.length > 0 && (
            <div className="px-2 py-2">
              <div className="flex items-center gap-1.5 px-1 pb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <PlaylistIcon size={16} />
                <span>Manually added</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {manualQueue.map((track, index) => (
                  <div
                    key={`${track.id}:${upcomingStartIndex + index}`}
                    data-queue-index={upcomingStartIndex + index}
                    data-queue-section="manual"
                    className={getTrackItemClassName(upcomingStartIndex + index)}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onPointerDown={(event) =>
                        handleTrackPointerDown(
                          event,
                          upcomingStartIndex + index,
                          "manual",
                        )
                      }
                      onClick={() => handlePlay(index)}
                    >
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-foreground">{track.title}</span>
                        <ArtistLinks
                          className="truncate text-xs text-muted-foreground"
                          artists={track.artists}
                          fallback={track.artist}
                        />
                      </span>
                     
                    </button>
                    <button
                      type="button"
                      className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/queue-item:opacity-100"
                      onClick={() => handleRemove(index)}
                      aria-label={`Remove ${track.title} from queue`}
                    >
                      <TrashIcon size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {autoQueue.length > 0 && (
            <div className="px-2 py-2">
              {manualQueue.length > 0 && (
                <div className="flex items-center gap-1.5 px-1 pb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <PlaylistIcon size={16} />
                  <span>Auto queue</span>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {autoQueue.map((track, index) => (
                  <div
                    key={`${track.id}:${upcomingStartIndex + manualQueueLength + index}`}
                    data-queue-index={upcomingStartIndex + manualQueueLength + index}
                    data-queue-section="automatic"
                    className={getTrackItemClassName(
                      upcomingStartIndex + manualQueueLength + index,
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onPointerDown={(event) =>
                        handleTrackPointerDown(
                          event,
                          upcomingStartIndex + manualQueueLength + index,
                          "automatic",
                        )
                      }
                      onClick={() => handlePlay(manualQueueLength + index)}
                    >
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {manualQueueLength + index + 1}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-foreground">{track.title}</span>
                        <ArtistLinks
                          className="truncate text-xs text-muted-foreground"
                          artists={track.artists}
                          fallback={track.artist}
                        />
                      </span>
                      
                    </button>
                    <button
                      type="button"
                      className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/queue-item:opacity-100"
                      onClick={() => handleRemove(manualQueueLength + index)}
                      aria-label={`Remove ${track.title} from queue`}
                    >
                      <TrashIcon size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
