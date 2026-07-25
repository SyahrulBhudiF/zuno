/**
 * Central icon module — every icon in the app is imported from here.
 *
 * Convention (see docs/solarIcons.md):
 *   - Default export  = Solar **Linear** (stroked, strokeWidth 1.5) for resting/secondary state.
 *   - `*ActiveIcon`   = Solar **Bold** (filled) for active/primary state — playing, liked,
 *                       saved, selected. The weight change is the state signal.
 *
 * Single-icon import paths are used deliberately: importing the style barrel
 * (`@solar-icons/react/linear`) makes the dev server resolve ~1.2k modules per style.
 *
 * Routing every icon through one file means a renamed or missing Solar icon breaks
 * this module alone, not the 27 component files that consume it.
 */

import type { SVGProps } from "react";

/* ── Transport ─────────────────────────────────────────────────────── */
export { PlayIcon } from "@solar-icons/react/linear/play";
export { PlayIcon as PlayActiveIcon } from "@solar-icons/react/bold/play";
export { PauseIcon } from "@solar-icons/react/linear/pause";
export { PauseIcon as PauseActiveIcon } from "@solar-icons/react/bold/pause";
export { SkipNextIcon } from "@solar-icons/react/linear/skip-next";
export { SkipNextIcon as SkipNextActiveIcon } from "@solar-icons/react/bold/skip-next";
export { SkipPreviousIcon } from "@solar-icons/react/linear/skip-previous";
export { SkipPreviousIcon as SkipPreviousActiveIcon } from "@solar-icons/react/bold/skip-previous";

/* ── Playback order ────────────────────────────────────────────────── */
export { ShuffleIcon } from "@solar-icons/react/linear/shuffle";
export { ShuffleIcon as ShuffleActiveIcon } from "@solar-icons/react/bold/shuffle";
export { RepeatIcon } from "@solar-icons/react/linear/repeat";
export { RepeatIcon as RepeatActiveIcon } from "@solar-icons/react/bold/repeat";
export { RepeatOneIcon } from "@solar-icons/react/linear/repeat-one";
export { RepeatOneIcon as RepeatOneActiveIcon } from "@solar-icons/react/bold/repeat-one";

/* ── Volume ────────────────────────────────────────────────────────── */
export { VolumeLoudIcon } from "@solar-icons/react/linear/volume-loud";
export { VolumeLoudIcon as VolumeLoudActiveIcon } from "@solar-icons/react/bold/volume-loud";
export { VolumeSmallIcon } from "@solar-icons/react/linear/volume-small";
export { VolumeCrossIcon as VolumeMutedIcon } from "@solar-icons/react/linear/volume-cross";
export { VolumeCrossIcon as VolumeMutedActiveIcon } from "@solar-icons/react/bold/volume-cross";

/* ── Library state (like / save / rate) ────────────────────────────── */
export { HeartIcon } from "@solar-icons/react/linear/heart";
export { HeartIcon as HeartActiveIcon } from "@solar-icons/react/bold/heart";
export { HeartCrackIcon as HeartBrokenIcon } from "@solar-icons/react/linear/heart-crack";
export { BookmarkIcon } from "@solar-icons/react/linear/bookmark";
export { BookmarkIcon as BookmarkActiveIcon } from "@solar-icons/react/bold/bookmark";
export { StarIcon } from "@solar-icons/react/linear/star";
export { StarIcon as StarActiveIcon } from "@solar-icons/react/bold/star";

/* ── Content types ─────────────────────────────────────────────────── */
export { MusicNoteIcon } from "@solar-icons/react/linear/music-note";
export { MusicNoteIcon as MusicNoteActiveIcon } from "@solar-icons/react/bold/music-note";
export { PlaylistIcon } from "@solar-icons/react/linear/playlist";
export { PlaylistIcon as PlaylistActiveIcon } from "@solar-icons/react/bold/playlist";
export { PlaylistMinimalisticIcon as PlaylistAddIcon } from "@solar-icons/react/linear/playlist-minimalistic";
export { VinylIcon as AlbumIcon } from "@solar-icons/react/linear/vinyl";
export { VinylIcon as AlbumActiveIcon } from "@solar-icons/react/bold/vinyl";
export { Microphone2Icon as LyricsIcon } from "@solar-icons/react/linear/microphone-2";
export { Microphone2Icon as LyricsActiveIcon } from "@solar-icons/react/bold/microphone-2";

/* ── Files & folders (local music) ─────────────────────────────────── */
export { FolderIcon } from "@solar-icons/react/linear/folder";
export { FolderOpenIcon } from "@solar-icons/react/linear/folder-open";
export { AddFolderIcon as FolderAddIcon } from "@solar-icons/react/linear/add-folder";
export { DocumentTextIcon as LogFileIcon } from "@solar-icons/react/linear/document-text";

/* ── Navigation & chrome ───────────────────────────────────────────── */
export { Home2Icon as HomeIcon } from "@solar-icons/react/linear/home-2";
export { Home2Icon as HomeActiveIcon } from "@solar-icons/react/bold/home-2";
export { SidebarMinimalisticIcon as QueuePanelIcon } from "@solar-icons/react/linear/sidebar-minimalistic";
export { MagnifierIcon as SearchIcon } from "@solar-icons/react/linear/magnifier";
export { PaletteIcon } from "@solar-icons/react/linear/palette";
export { PaletteIcon as PaletteActiveIcon } from "@solar-icons/react/bold/palette";
export { SettingsIcon } from "@solar-icons/react/linear/settings";
export { SettingsIcon as SettingsActiveIcon } from "@solar-icons/react/bold/settings";
export { ListIcon } from "@solar-icons/react/linear/list";
export { CloseCircleIcon as CloseIcon } from "@solar-icons/react/linear/close-circle";
export { CloseCircleIcon as CloseActiveIcon } from "@solar-icons/react/bold/close-circle";
export { AddCircleIcon as PlusIcon } from "@solar-icons/react/linear/add-circle";
export { CheckCircleIcon as CheckIcon } from "@solar-icons/react/linear/check-circle";
export { CheckCircleIcon as CheckActiveIcon } from "@solar-icons/react/bold/check-circle";
export { RefreshIcon } from "@solar-icons/react/linear/refresh";
export { TrashBinTrashIcon as TrashIcon } from "@solar-icons/react/linear/trash-bin-trash";
export { CopyIcon } from "@solar-icons/react/linear/copy";
export { LinkIcon } from "@solar-icons/react/linear/link";

/* ── Arrows ────────────────────────────────────────────────────────── */
export { ArrowUpIcon } from "@solar-icons/react/linear/arrow-up";
export { ArrowDownIcon } from "@solar-icons/react/linear/arrow-down";
export { ArrowLeftIcon } from "@solar-icons/react/linear/arrow-left";
export { ArrowRightIcon } from "@solar-icons/react/linear/arrow-right";
export { AltArrowDownIcon as ChevronDownIcon } from "@solar-icons/react/linear/alt-arrow-down";

/* ── Account & settings surfaces ───────────────────────────────────── */
export { UserIcon } from "@solar-icons/react/linear/user";
export { UserIcon as UserActiveIcon } from "@solar-icons/react/bold/user";
export { UserPlusIcon } from "@solar-icons/react/linear/user-plus";
export { Login2Icon as LoginIcon } from "@solar-icons/react/linear/login-2";
export { Logout2Icon as LogoutIcon } from "@solar-icons/react/linear/logout-2";
export { KeyIcon } from "@solar-icons/react/linear/key";
export { BugIcon } from "@solar-icons/react/linear/bug";
export { ClockCircleIcon as ClockIcon } from "@solar-icons/react/linear/clock-circle";
export { CupHotIcon as CoffeeIcon } from "@solar-icons/react/linear/cup-hot";
export { MagicWandIcon as DiceIcon } from "@solar-icons/react/linear/magic-wand";
export { MagicWandIcon as DiceActiveIcon } from "@solar-icons/react/bold/magic-wand";

/**
 * GitHub brand mark.
 *
 * Same reasoning as `LastFmIcon` below: Solar ships no brand icons, and a brand mark has to
 * stay recognisable rather than be approximated by a generic glyph.
 * Path from Simple Icons (CC0), sized/coloured like a Solar icon.
 */
export function GitHubIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/**
 * Last.fm brand mark.
 *
 * Solar ships no brand icons, and a brand mark must stay recognisable — so this one stays
 * a hand-rolled SVG rather than being approximated by a generic music glyph.
 * Path from Simple Icons (CC0). Sized/coloured like a Solar icon so it drops into the same slots.
 */
export function LastFmIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.62-3.932l-1.757-.385c-1.21-.275-1.567-.77-1.567-1.594 0-.934.742-1.485 1.952-1.485 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.602l1.87.44c1.402.33 1.869.907 1.869 1.694 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.93-1.457-4.59-3.464l-.907-2.749c-1.155-3.573-3-4.893-6.653-4.893C2.008 5.977 0 8.424 0 12.597c0 4.013 2.063 6.184 5.774 6.184 2.997 0 4.435-1.402 4.435-1.402l.375-.169z" />
    </svg>
  );
}
