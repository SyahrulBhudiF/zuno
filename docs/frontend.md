# Frontend — components, pages, modules

React 19 + TypeScript, CSS Modules, `@tabler/icons-react`. No router, no CSS framework, no state
library. See [architecture.md](./architecture.md) for the system view and [backend.md](./backend.md)
for the IPC surface.

---

## 1. Entry points

### `src/main.tsx` — main window

Runs before React mounts:

1. `applyPlatformAttributes()` — sets `data-platform-linux` on `<html>`.
2. `applyPaperPcMode()` / `applyNativeWindowControls()` — synchronous theme + decoration flags from localStorage.
3. `hydrateMainWindowGeometry()` → `restoreMainWindowGeometry()`.
4. `Promise.all` of the seven `hydrate*` functions (paperPc, windowControls, miniPlayer, playerControls, lastFm, keyboardShortcuts, playbackSettings) — these reconcile localStorage against Rust-owned durable settings.
5. `DiscordRpcService.init()`.
6. `window.error` + `window.unhandledrejection` → `logInternalError`.
7. `createRoot().render(<React.StrictMode><App/></React.StrictMode>)`.

### `src/mini.tsx` — mini-player window

Minimal: platform attributes, `hydrateMiniPlayerSettings()`, render `<MiniPlayer/>`. It holds no
controllers — all state arrives over Tauri events from the main window.

---

## 2. `App.tsx` — the root

1717 lines, the only component with meaningful state. It owns:

| Concern | State / refs |
|---|---|
| Tabs | `tabs: Tab[]`, `activeTabId`, `nextTabId` — restored from `loadAppSession()` |
| Navigation | Per-tab `navigationHistory: { back: TabViewState[], forward: TabViewState[] }` |
| Layout | `sidebarWidth`, right-panel width, queue-panel open state |
| Onboarding | `onboardingStep`, keychain notice, completion toast |
| Updates | `availableUpdate`, snooze handling |
| Loading screen | `loadingScreenState`, min 1000 ms / max 4000 ms, 80 ms fade |
| Mini player | positioning, focus-driven show/hide, suppression windows during drags |
| Recovery | sleep detection (15 s timer, 60 s drift threshold) → reload; connection recovery on window focus |

### The tab model (`ui/types/tab.ts`)

```ts
type TabView = "home" | "album" | "artist" | "playlist" | "search" | "settings";

interface Tab {
  id: string;
  view: TabView;
  title?: string;
  album?: Album; artist?: Artist; playlist?: Playlist;
  searchQuery?: string; searchResults?: Track[]; mixedSearchResults?: SearchResults;
  searchLoading?: boolean;
  isQueueOpen?: boolean;
  navigationHistory?: TabNavigationHistory;
}
```

A tab is *both* a browser-style navigation context **and** an independent player. `settings` is
excluded from navigation history (`NavigableTabView`), so opening Settings never pollutes back/forward.
`getNavigationKey()` deduplicates consecutive identical entries; `stripNavigationHistory()` keeps
history out of the persisted session.

### Global keyboard handling

Shortcuts come from `ui/settings/keyboardShortcuts.ts` (user-remappable, persisted). `App.tsx`
matches them with `eventMatchesShortcut` for: play/pause, mute, previous/next, new tab, close tab,
search, navigate back/forward, and jump-to-tab 1–9. Mouse buttons 3/4 map to back/forward.
`ui/pages/pageSearchKeyboard.ts` decides when a bare printable keypress should start in-page search —
it refuses when focus is in a text field or when the key matches any bound shortcut.

### Render tree

```
<ArtistNavigationProvider>          artist-link click → navigate current tab
 <TrackContextMenuProvider>         right-click track menu, like/queue/playlist actions
  <PlaylistContextMenuProvider>     right-click playlist/album menu
   <TitleBar>                       drag region, MusicTabs, window controls
   <Layout sidebar + rightPanel>    Sidebar, SearchBar, StarField, custom scrollbar
     └ page: HomePage | AlbumView | ArtistView | PlaylistView | SearchResultsPage | SettingsPage
     └ rightPanel: <QueuePanel>
     └ overlay: <LyricsView>
   <PlayerBar>                      TrackInfo, PlaybackControls, SeekBar, VolumeControl, LyricsButton
   <SearchOverlay>                  Ctrl/⌘+K
   <AppLoadingScreen> <KeychainNotice> <Onboarding*> <UpdateToast>
```

---

## 3. Components (`src/ui/components/`)

Every component has a co-located `*.module.css`.

### Chrome and layout

| Component | Purpose |
|---|---|
| `TitleBar.tsx` | Custom frameless title bar: drag region, home button (collapses to icon-only under 120 px sidebar), embedded `MusicTabs`, and minimize/maximize/close. Honours the "Windows-style controls" and "native controls" settings; hidden entirely when native decorations are on. |
| `MusicTabs.tsx` | Tab strip with pointer-based drag reorder, close buttons, a volume icon marking the tab currently producing sound, and a 32-char title ellipsis. |
| `Layout.tsx` | Three-column shell: resizable sidebar, page content, optional right panel. Implements a custom transient scrollbar (browser scrollbars are hidden globally in `global.css`) with hover/drag persistence and 760 ms auto-hide. Renders `StarField` unless Paper-PC mode is on. |
| `Sidebar.tsx` | Library navigation: liked songs, playlists, albums, local playlists. Drag-and-drop ordering persisted per list (`ytc-sidebar-playlist-order`, `ytc-sidebar-album-order`) with a one-time migration pinning Liked Songs first. Sorts by recent-play timestamps. Right-click opens the playlist context menu. |
| `SearchBar.tsx` | Inline search entry in the layout header; opens the overlay. |
| `StarField.tsx` | Decorative animated background; skipped in Paper-PC mode. |

### Content and interaction

| Component | Purpose |
|---|---|
| `SearchOverlay.tsx` | ⌘/Ctrl+K palette. Fuzzy-scores your playlists/albums locally (`searchMatchScore`: exact 4 → prefix 3 → contains 2 → reverse-contains 1, with NFKD-normalized fallbacks), fetches remote suggestions, keeps 5 recent searches. Shift-Enter opens results in a new tab. |
| `TrackContextMenu.tsx` | React context provider + menu: like/unlike, play next, add to queue, add to playlist (with submenu and pending state), remove from playlist, copy link, search artist. Handles viewport-edge flipping via `useLayoutEffect`. |
| `PlaylistContextMenu.tsx` | Same pattern for playlists/albums: play, save/unsave, local-playlist management, remove. |
| `ArtistLinks.tsx` | Renders `Track.artists[]` as individually clickable links through `ArtistNavigationProvider`; falls back to the plain artist string. |
| `TrackArtwork.tsx` | Artwork with loading/fallback states and consistent sizing. |
| `AlbumCard.tsx` | Grid card for albums/playlists. |
| `DiceCard.tsx` / `MagicDice.tsx` | The "surprise me" shuffle entry point on the home page. |
| `Onboarding.tsx` | `OnboardingWelcome`, stepped `Onboarding`, `OnboardingCompleteToast`, and `KeychainNotice` (macOS keychain-prompt explainer). |
| `AppLoadingScreen.tsx` | Startup splash with a leaving/fade state. |
| `UpdateToast.tsx` | Update available → download progress → restart, or "open release page" on macOS. |

### Player (`components/player/`)

| Component | Purpose |
|---|---|
| `PlayerBar.tsx` | Bottom bar composing the pieces below; also surfaces connection-restored recovery. |
| `TrackInfo.tsx` | Artwork + title + `ArtistLinks`, click-through to album/artist. |
| `PlaybackControls.tsx` | Previous / play-pause / next, plus shuffle-repeat cycling (`in-order → shuffle → repeat-one` in playlist mode, `shuffle ⇄ repeat-one` otherwise). |
| `SeekBar.tsx` | Position scrubber; writes `isSeeking` to `playerUIStore` so position polling doesn't fight the drag. |
| `VolumeControl.tsx` | Slider + mute; writes `isDraggingVolume` to the UI store. |
| `LyricsButton.tsx` | Toggles the lyrics overlay. |
| `QueuePanel.tsx` | Right-panel queue with drag reorder, remove, and jump-to-index. Reordering is restricted to within a queue region (manual↔manual, automatic↔automatic) — `Queue.move()` rejects cross-region moves. |
| `ExpandedPlayerBar.tsx` | **Not rendered** — its JSX in `App.tsx` is commented out. |

### Mini player (`components/mini-player/MiniPlayer.tsx`)

A 160×80 transparent always-on-top pill in its own window.

- Appears on `main-window-backgrounded`, hides on `window-focused`.
- Expands on hover into a two-pill layout (top 36 px + bottom 40 px, 2 px gap) with transport controls.
- Right-mouse or empty-area drag moves the window; the position is debounced (350 ms) into settings.
- Hover behaviour over the progress area is configurable: `seek` or `volume` (`mini-player-hover-action`).
- Communicates purely over Tauri events — player status, time, and volume snapshots in; control commands out.

---

## 4. Pages (`src/ui/pages/`)

| Page | Notes |
|---|---|
| `HomePage.tsx` | Recently played + generated suggestions. Suggestions are memoized per tab in module-level `Map`s (`suggestionCache`, `suggestionLoads`) so switching tabs doesn't refetch. Falls back to canned queries (`"new music"`, `"indie mix"`, …) when signed out. Hosts `DiceCard` — the random-shuffle wheel. |
| `AlbumView.tsx` | Album header + track list, save/unsave, play-all, per-track context menu. |
| `ArtistView.tsx` | Artist header, subscribe toggle, popular songs, all songs, releases, playlists. Subscription state has a 60 s optimistic override because the remote value lags. |
| `PlaylistView.tsx` | Paginated track list (`getPlaylistTrackPage` with a page-key session cached 10 min), in-page search filter, drag reorder for local playlists, remove-from-playlist. |
| `SearchResultsPage.tsx` | Mixed results grouped by artists / tracks / albums / playlists, painted incrementally from streaming `onUpdate` callbacks. |
| `LyricsView.tsx` | Overlay. Synced lyrics scroll to the active line based on player position; falls back to plain text when timing is `estimated`/`none`. |
| `SettingsPage.tsx` | Six sections — Account, Last.fm, About, System, Keyboard shortcuts, Window controls, Behavior. Covers sign-in/out, scrobbling, version + update check, cache size and clearing, local music folders (`dialog:open` → `local_audio_scan`), shortcut rebinding, decoration/control style, autostart, mini player, Paper-PC mode, geometry persistence, log file access, and "delete all app data". |
| `pageSearchKeyboard.ts` | `shouldStartPageSearch()` — see §2. |

---

## 5. Settings modules (`src/ui/settings/`)

All follow the same shape: a storage key, a change-event name, `read*` / `set*` / `hydrate*`
functions, and a `use*` hook built on `useSyncExternalStore` that listens to both the custom event
and `storage` (for cross-window sync). Writes go to localStorage **and** durable Rust settings via
`internal/durableLocalSetting.ts`.

| Module | Setting(s) |
|---|---|
| `keyboardShortcuts.ts` | Full remappable map for 19 actions (`playPause`, `mute`, `previousTrack`, `nextTrack`, `newTab`, `closeTab`, `search`, `navigateBack/Forward`, `tab1`–`tab9`), with `eventMatchesShortcut` and platform-aware modifier labels (⌘ vs Ctrl). |
| `miniPlayer.ts` | Enabled flag, saved position (debounced), hover action, `resetMiniPlayerPosition()`. |
| `mainWindowGeometry.ts` | Size + position persistence with a min-size guard (900×600) and monitor-bounds validation; toggleable, and clears the stored value when disabled. |
| `windowControls.ts` | `native-window-controls` (default on for Linux) and `windows-style-window-controls`; applies `setDecorations()` and toggles `data-native-window-controls`. |
| `paperPcMode.ts` | Low-end mode: kills animations, transitions, shadows, and backdrop filters via `data-paper-pc`. Reloads on Linux where blur can't be toggled live. |
| `playerControls.ts` | Player bar control visibility preferences. |
| `lastfm.ts` | Scrobbling enabled flag + connection state. |
| `autostart.ts` | `tauri-plugin-autostart` enable/disable/isEnabled. |

---

## 6. Stores and hooks

| Export | Source | Purpose |
|---|---|---|
| `usePlayerState()` | `player/playerStore.ts` | Effective player's `PlayerState` (status, current track, history, order mode, volume, muted) |
| `usePlayerSession()` | same | Full session snapshot including the queue |
| `useLibraryState()` | same | `LibraryController` state (status, library snapshot, auth prompt, pending likes) |
| `usePlayerUIState()` | `ui/stores/playerUIStore.ts` | Transient UI: `isSeeking`, `isDraggingVolume`, `showAlbumArt`, `isLyricsOpen`, `isQueueOpen` |
| `useDisableContextMenu()` | `ui/hooks/` | Suppresses the native WebView context menu app-wide |
| `isMacOS` / `isLinux` / `isWindows`, `primaryModifierLabel`, `hasPrimaryModifierOnly()` | `ui/platform.ts` | UA-based platform detection |

`playerController` (from `playerStore`) is the facade any component should call — it always resolves
to the correct tab's `PlayerController` and claims playback ownership when starting new audio.

---

## 7. Styling

**Tailwind CSS v4** via `@tailwindcss/vite`, with one global sheet at `ui/styles/global.css`.
There are no CSS Modules — all 33 `*.module.css` files were deleted in the beUI migration.

- **Design tokens live in a Tailwind `@theme` block** and follow shadcn naming, because that is
  what the vendored beUI components are written against: `--color-background`, `--color-foreground`,
  `--color-card`, `--color-popover`, `--color-muted` / `--color-muted-foreground`, `--color-border`,
  `--color-input`, `--color-ring`, `--color-destructive`, and `--color-primary`.
- The palette is **neutral shadcn surfaces + the app's `#ff0033` as `--color-primary`**. Red is an
  accent only — use `bg-primary` / `text-primary` for play state, active tabs and primary actions,
  never for large surfaces.
- `:root` keeps only two non-colour constants, read from TSX as `var(--titlebar-height)` and
  `var(--sidebar-width)`.
- Global resets beyond Tailwind preflight: `body { overflow: hidden }`, scrollbars zeroed out
  (`Layout.tsx` draws its own transient scrollbar), text selection disabled except in inputs,
  focus rings only on `:focus-visible`.
- **Theme/behaviour switches are HTML attributes**, not classes:
  - `html[data-paper-pc]` — overrides the `@theme` colours with fully opaque equivalents and kills
    animation, box-shadow and backdrop-filter. Note this only stops *CSS* animation; beUI's
    JS-driven motion is stopped by the `<MotionConfig reducedMotion>` bridge in `App.tsx`.
  - `html[data-platform-linux]` — disables backdrop filters (WebKitGTK performance).
  - `html[data-native-window-controls]` — hides the custom window buttons.
- Dark-only. There is no light theme.

### Component vocabulary

Animated primitives are vendored from the [beUI](https://beui.dev) registry into
`src/components/motion/` and `src/components/blocks/`, with shared helpers in `src/lib/`
(`cn`, `ease`, `use-hover-capable`). They are kept at the registry's own paths so a future
re-pull drops in without rewriting imports. App-owned components stay in `src/ui/`.

In use: `button` (base/stateful/magnetic), `tooltip`, `tabs`, `drawer`, `input`, `loader`,
`marquee`, `tilt-card`, `popover`, `command-palette`, `center-morph-modal`, `bouncy-accordion`,
`bounce-sidebar`, `range-slider`, `shader-background`, `action-swap`.

**When re-pulling from the registry**, run the de-lucide pass afterwards — beUI ships
`lucide-react` imports for its default icons, and this project uses Solar exclusively.

### Icons

All icons come from `@solar-icons/react` (pinned to `2.0.0-beta.0` — the v2 API does not exist on
the `latest` 1.x line) and are re-exported from **`src/ui/icons.tsx`**. Components import only from
there, never from `@solar-icons/react` directly, so a renamed upstream icon breaks one file.

Convention: the default export is Solar **Linear** (resting/secondary state); a `*ActiveIcon`
alias is Solar **Bold** (active/primary — playing, liked, saved, selected). The weight change
*is* the state signal. Solar ships no brand icons, so `LastFmIcon` stays a hand-rolled inline SVG.

Solar icons take `strokeWidth`, not the raw SVG `stroke` attribute.

---

## 8. Conventions worth keeping

- **Feature-detect optional data-source methods** (`this.dataSource.getLyrics?.(...)`) instead of assuming.
- **Guard async work with request ids** — the codebase uses this everywhere for cancellation; a bare `await` that then calls `setState` is a bug waiting for a fast click.
- **Two-tier settings**: never write only to localStorage; use the `durableLocalSetting` helpers so the value survives a WebView data reset.
- **Log through `internal/logging.ts`**, never raw `console.*` — it redacts secrets and mirrors to the on-disk log.
- **New Tauri command?** Add it to `src-tauri/capabilities/default.json` or the call silently fails.
- **Optimistic mutations roll back**: `LibraryController` snapshots the previous library, applies the change, and restores on error. Match that pattern for new mutations.
