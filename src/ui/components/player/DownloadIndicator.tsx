import { cn } from "@/lib/utils";
import { Loader } from "@/components/motion/loader";
import { Tooltip } from "@/components/motion/tooltip";
import { useOfflineState } from "../../../player/offlineStore";

/**
 * Download activity in the player bar.
 *
 * Renders nothing when idle. Downloading is background work with no other persistent home —
 * without this the only way to know whether anything is happening is to open the Downloads
 * tab and watch it, which is the opposite of background.
 */
export function DownloadIndicator() {
  const offline = useOfflineState();
  const activeTrack = offline.downloadingId
    ? offline.pending[offline.downloadingId]
    : undefined;

  if (!offline.downloadingId) return null;

  const remaining = offline.queued.length;
  const title = activeTrack?.title ?? "a song";
  const label = remaining > 0
    ? `Downloading ${title} · ${remaining} more queued`
    : `Downloading ${title}`;

  return (
    <Tooltip content={label}>
      <span
        role="status"
        aria-label={label}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-primary",
          // Not a button: there is nothing useful to do here that the Downloads tab does not
          // do better, and a control that only reports would invite a pointless click.
          "cursor-default",
        )}
      >
        <Loader
          variant="percent"
          size={16}
          value={offline.progress ?? undefined}
          label={label}
        />
        {remaining > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">+{remaining}</span>
        )}
      </span>
    </Tooltip>
  );
}
