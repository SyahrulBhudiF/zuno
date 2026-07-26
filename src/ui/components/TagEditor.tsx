import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/motion/loader";
import { CloseIcon } from "@/ui/icons";
import type { Track } from "../../datasource/types";
import { logInternalError } from "../../internal/logging";

export interface LocalAudioTags {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  trackNumber?: number;
  year?: number;
}

const FIELDS: Array<{ key: keyof LocalAudioTags; label: string; numeric?: boolean }> = [
  { key: "title", label: "Title" },
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "albumArtist", label: "Album artist" },
  { key: "genre", label: "Genre" },
  { key: "trackNumber", label: "Track number", numeric: true },
  { key: "year", label: "Year", numeric: true },
];

const FIELD =
  "w-full min-w-0 rounded-lg bg-background px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-inset focus:ring-border";

/**
 * Edits the tags written into a local audio file.
 *
 * Values are loaded from the file rather than from the scanned track: the scanner falls back
 * to the filename and parent folder when a file has no tags, and saving those guesses back
 * would silently turn them into real metadata.
 */
export function TagEditor({
  track,
  onClose,
  onSaved,
}: {
  track: Track;
  onClose: () => void;
  /** Fired after a successful write so the caller can rescan. */
  onSaved?: () => void;
}) {
  const [tags, setTags] = useState<LocalAudioTags | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!track.localPath) {
      setError("This song has no file on disk.");
      return;
    }

    invoke<LocalAudioTags>("local_audio_read_tags", { path: track.localPath })
      .then((loaded) => {
        if (!cancelled) setTags(loaded);
      })
      .catch((cause: unknown) => {
        logInternalError("TagEditor.read failed", cause, { path: track.localPath });
        if (!cancelled) setError("Could not read the tags on this file.");
      });

    return () => {
      cancelled = true;
    };
  }, [track.localPath]);

  const save = async () => {
    if (!tags || !track.localPath || saving) return;
    setSaving(true);
    setError(null);
    try {
      await invoke("local_audio_write_tags", { path: track.localPath, tags });
      onSaved?.();
      onClose();
    } catch (cause) {
      logInternalError("TagEditor.write failed", cause, { path: track.localPath });
      setError(cause instanceof Error ? cause.message : "Could not save the tags.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-background/70 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit tags for ${track.title}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-popover p-5 shadow-2xl ring-1 ring-border">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-base font-semibold text-foreground">Edit tags</h2>
            <p className="truncate text-xs text-muted-foreground">{track.localPath}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CloseIcon size={18} />
          </button>
        </header>

        {tags === null && !error ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader variant="spinner" size={16} />
            Reading tags...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((field) => (
              <label
                key={field.key}
                className={cn(
                  "flex flex-col gap-1 text-xs text-muted-foreground",
                  !field.numeric && "col-span-2",
                )}
              >
                {field.label}
                <input
                  className={FIELD}
                  type={field.numeric ? "number" : "text"}
                  value={String(tags?.[field.key] ?? "")}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setTags((current) => ({
                      ...current,
                      // Blank clears the tag, which is why undefined is stored rather than "".
                      [field.key]: field.numeric
                        ? (raw === "" ? undefined : Number(raw))
                        : (raw === "" ? undefined : raw),
                    }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void save();
                    if (event.key === "Escape") onClose();
                  }}
                />
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <footer className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || tags === null}
            onClick={() => void save()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {saving ? "Saving..." : "Save to file"}
          </button>
        </footer>
      </div>
    </div>
  );
}
