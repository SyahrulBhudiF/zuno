import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { Switch } from "@/components/motion/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import {
  BugIcon,
  CoffeeIcon,
  FolderAddIcon,
  FolderIcon,
  FolderOpenIcon,
  KeyIcon,
  LastFmIcon,
  LoginIcon,
  LogFileIcon,
  LogoutIcon,
  PaletteIcon,
  QueuePanelIcon,
  RefreshIcon,
  StarIcon,
  TrashIcon,
  UserIcon,
} from "@/ui/icons";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from "../settings/theme";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  checkForUpdates,
  getUpdateFailureMessage,
  getInstalledVersion,
  installUpdate,
  type UpdateInfo,
  type UpdateInstallProgress,
} from "../../internal/updateChecker";
import {
  clearCache,
  DEFAULT_CACHE_SIZE_GB,
  getCacheStats,
  setCacheMaxBytes,
  type CacheStats,
} from "../../internal/cache";
import type { LibraryController, LibraryState } from "../../player/LibraryController";
import {
  getAutostartEnabled,
  setAutostartEnabled,
} from "../settings/autostart";
import {
  setExtraPlayerControlsAlwaysVisible,
  useExtraPlayerControlsAlwaysVisible,
} from "../settings/playerControls";
import { setPaperPcMode, usePaperPcMode } from "../settings/paperPcMode";
import {
  setNativeWindowControls,
  setWindowsStyleWindowControls,
  useNativeWindowControls,
  useWindowsStyleWindowControls,
} from "../settings/windowControls";
import {
  resetMiniPlayerPosition,
  setMiniPlayerEnabled,
  setMiniPlayerHoverAction,
  useMiniPlayerEnabled,
  useMiniPlayerHoverAction,
  type MiniPlayerHoverAction,
} from "../settings/miniPlayer";
import {
  setMainWindowGeometryPersistenceEnabled,
  useMainWindowGeometryPersistenceEnabled,
} from "../settings/mainWindowGeometry";
import {
  captureKeyboardShortcut,
  formatKeyboardShortcut,
  KEYBOARD_SHORTCUT_ACTIONS,
  resetKeyboardShortcut,
  resetKeyboardShortcuts,
  setKeyboardShortcut,
  useKeyboardShortcuts,
  type KeyboardShortcutAction,
} from "../settings/keyboardShortcuts";
import {
  addLocalPlaylistPath,
  createLocalPlaylist,
  deleteLocalPlaylist,
  getLocalPlaylists,
  removeLocalPlaylistPath,
  subscribeToLocalPlaylists,
} from "../../player/localPlaylists";
import { LastFmService, type LastFmAuthStart, type LastFmSessionStatus } from "../../player/LastFm";
import {
  setLastFmScrobblingEnabled,
  useLastFmScrobblingEnabled,
} from "../settings/lastfm";
import { isLinux } from "../platform";
import { GITHUB_NEW_ISSUE_URL, GITHUB_REPOSITORY_URL } from "../links";

const KOFI_URL = "https://ko-fi.com/totally2late";

/*
 * Label + description pair used by every settings row.
 *
 * `flex flex-col` is the load-bearing part: both children are inline elements, so without a
 * block/flex wrapper the description runs straight on from the label ("Scrobble playsSend
 * now playing updates...") — the CSS Modules used to stack them and the Tailwind migration
 * dropped it.
 */
const SETTING_LABEL =
  "flex flex-col gap-0.5 text-sm text-muted-foreground [&>strong]:text-sm [&>strong]:font-medium [&>strong]:text-foreground";

/** Section card. One shape for every group so the page reads as a single system. */
const SETTINGS_CARD = "flex flex-col gap-5 rounded-2xl bg-card/50 p-6";

/**
 * Text field. Preflight strips the browser's default input chrome, and these two fields were
 * left bare by the CSS Modules migration — they rendered as invisible text on the card.
 */
const SETTINGS_FIELD =
  "min-w-0 rounded-lg bg-background px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring/60";

/**
 * One settings row: label and description on the left, control on the right.
 *
 * The wrapper is a `div`, not a `label`, because the controls are now buttons
 * (`role="switch"`, `role="listbox"`) rather than native inputs — a button inside a label
 * gets its activation swallowed by the label's own click forwarding. The association is made
 * explicitly instead, via `aria-labelledby` on the control, so screen readers still announce
 * the row title when the control takes focus.
 */
function SettingRow({
  title,
  description,
  disabled,
  children,
}: {
  title: string;
  description?: ReactNode;
  disabled?: boolean;
  /** Receives the id of the row title so the control can point `aria-labelledby` at it. */
  children: (labelId: string) => ReactNode;
}) {
  const labelId = useId();
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-6 py-2.5",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-sm font-medium text-foreground">
          {title}
        </span>
        {description ? (
          <span className="text-sm text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-2 pt-0.5">{children(labelId)}</span>
    </div>
  );
}

/** The common case: a row whose only control is a switch. */
function SettingToggle({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  title: string;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow title={title} description={description} disabled={disabled}>
      {(labelId) => (
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-labelledby={labelId}
        />
      )}
    </SettingRow>
  );
}

/** Quiet outbound links at the foot of the page. */
const SETTINGS_FOOTER_LINK =
  "flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md";

type SettingsTab = "about" | "appearance" | "system" | "shortcuts" | "window";

const SETTINGS_TABS: Array<{
  id: SettingsTab;
  label: string;
  description: string;
  icon: typeof UserIcon;
}> = [
  { id: "about", label: "Account", description: "Sign-in, Last.fm, updates", icon: UserIcon },
  { id: "appearance", label: "Appearance", description: "Theme and motion", icon: PaletteIcon },
  { id: "system", label: "Library", description: "Cache and local files", icon: FolderIcon },
  { id: "window", label: "Window", description: "Chrome and mini player", icon: QueuePanelIcon },
  { id: "shortcuts", label: "Shortcuts", description: "Keyboard bindings", icon: KeyIcon },
];

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  hint: string;
  swatch: string;
}> = [
  { value: "light", label: "Light", hint: "Always light", swatch: "bg-white" },
  { value: "dark", label: "Dark", hint: "Always dark", swatch: "bg-neutral-900" },
  {
    value: "system",
    label: "System",
    hint: "Match the OS",
    swatch: "bg-linear-to-br from-white to-neutral-900",
  },
];

interface SettingsPageProps {
  libraryController: LibraryController;
  libraryState: LibraryState;
  onRestartOnboarding: () => void;
  onSignIn: () => Promise<void>;
  onDeleteAllAppData: () => Promise<void>;
}

export function SettingsPage({
  libraryController,
  libraryState,
  onRestartOnboarding,
  onSignIn,
  onDeleteAllAppData,
}: SettingsPageProps) {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheSizeGb, setCacheSizeGb] = useState(DEFAULT_CACHE_SIZE_GB.toString());
  const [cacheBusy, setCacheBusy] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "checking" | "installing" | "current" | "error"
  >("idle");
  const [updateProgress, setUpdateProgress] = useState<UpdateInstallProgress | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [autostartEnabled, setAutostartEnabledState] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(true);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const [logOpening, setLogOpening] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [miniPlayerResetting, setMiniPlayerResetting] = useState(false);
  const [resetSettingsConfirming, setResetSettingsConfirming] = useState(false);
  const [resetSettingsBusy, setResetSettingsBusy] = useState(false);
  const [resetSettingsError, setResetSettingsError] = useState<string | null>(null);
  const [localPlaylistName, setLocalPlaylistName] = useState("");
  const [localPlaylistPathInputs, setLocalPlaylistPathInputs] = useState<Record<string, string>>({});
  const [localPlaylistError, setLocalPlaylistError] = useState<string | null>(null);
  const [localPlaylistBrowsingId, setLocalPlaylistBrowsingId] = useState<string | null>(null);
  const [lastFmSession, setLastFmSession] = useState<LastFmSessionStatus | null>(null);
  const [lastFmAuth, setLastFmAuth] = useState<LastFmAuthStart | null>(null);
  const [lastFmBusy, setLastFmBusy] = useState(false);
  const [lastFmError, setLastFmError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("about");
  const themePreference = useThemePreference();
  const [listeningShortcut, setListeningShortcut] = useState<KeyboardShortcutAction | null>(null);
  const keyboardShortcuts = useKeyboardShortcuts();
  const paperPcMode = usePaperPcMode();
  const miniPlayerEnabled = useMiniPlayerEnabled();
  const miniPlayerHoverAction = useMiniPlayerHoverAction();
  const extraPlayerControlsAlwaysVisible = useExtraPlayerControlsAlwaysVisible();
  const windowsStyleWindowControls = useWindowsStyleWindowControls();
  const nativeWindowControls = useNativeWindowControls();
  const mainWindowGeometryPersistenceEnabled = useMainWindowGeometryPersistenceEnabled();
  const lastFmScrobblingEnabled = useLastFmScrobblingEnabled();
  const localPlaylists = useSyncExternalStore(
    subscribeToLocalPlaylists,
    getLocalPlaylists,
    getLocalPlaylists,
  );
  const account = libraryState.library?.account;
  const isSignedIn = libraryState.status === "ready" && account;
  const authBusy = libraryState.status === "restoring"
    || libraryState.status === "authorizing"
    || libraryState.status === "loading";

  useEffect(() => {
    let active = true;
    void getCacheStats()
      .then((stats) => {
        if (!active) return;
        setCacheStats(stats);
        setCacheSizeGb((stats.maxBytes / 1024 ** 3).toString());
      })
      .catch(() => {
        if (active) setCacheError("Unable to load cache settings.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getInstalledVersion()
      .then((version) => {
        if (active) setInstalledVersion(version);
      })
      .catch(() => {
        if (active) setInstalledVersion("Unknown");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void LastFmService.getSession()
      .then((session) => {
        if (active) setLastFmSession(session);
      })
      .catch((error) => {
        if (active) {
          setLastFmError(error instanceof Error ? error.message : "Unable to load Last.fm connection.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!resetSettingsConfirming) return undefined;
    const timeout = window.setTimeout(() => setResetSettingsConfirming(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [resetSettingsConfirming]);

  const handleCheckForUpdates = async () => {
    setUpdateStatus("checking");
    setUpdateResult(null);
    setUpdateError(null);
    setUpdateProgress(null);
    try {
      const update = await checkForUpdates();
      setUpdateResult(update);
      setUpdateStatus(update ? "idle" : "current");
    } catch (error) {
      setUpdateError(getUpdateFailureMessage(error));
      setUpdateStatus("error");
    }
  };

  const handleInstallUpdate = async () => {
    if (!updateResult) return;
    setUpdateStatus("installing");
    setUpdateError(null);
    try {
      await installUpdate(updateResult, setUpdateProgress);
    } catch {
      setUpdateError("Unable to install the update. You can download it from GitHub.");
      setUpdateStatus("error");
    }
  };

  useEffect(() => {
    let active = true;
    void getAutostartEnabled()
      .then((enabled) => {
        if (active) setAutostartEnabledState(enabled);
      })
      .catch(() => {
        if (active) setAutostartError("Unable to load the startup setting.");
      })
      .finally(() => {
        if (active) setAutostartLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAutostartChange = async (enabled: boolean) => {
    setAutostartLoading(true);
    setAutostartError(null);
    try {
      await setAutostartEnabled(enabled);
      setAutostartEnabledState(enabled);
    } catch {
      setAutostartError("Unable to update the startup setting.");
    } finally {
      setAutostartLoading(false);
    }
  };

  const handleOpenLog = async () => {
    setLogOpening(true);
    setLogError(null);
    try {
      await invoke("open_current_log");
    } catch {
      setLogError("Unable to open the log file.");
    } finally {
      setLogOpening(false);
    }
  };

  const handleResetMiniPlayerPosition = async () => {
    setMiniPlayerResetting(true);
    try {
      await resetMiniPlayerPosition();
    } finally {
      setMiniPlayerResetting(false);
    }
  };

  const saveCacheSize = async () => {
    const sizeGb = Number(cacheSizeGb);
    if (!Number.isFinite(sizeGb) || sizeGb < 0.25 || sizeGb > 64) {
      setCacheError("Cache size must be between 0.25 GB and 64 GB.");
      return;
    }

    setCacheBusy(true);
    setCacheError(null);
    try {
      setCacheStats(await setCacheMaxBytes(Math.round(sizeGb * 1024 ** 3)));
    } catch {
      setCacheError("Unable to save the cache size.");
    } finally {
      setCacheBusy(false);
    }
  };

  const handleClearCache = async () => {
    setCacheBusy(true);
    setCacheError(null);
    try {
      setCacheStats(await clearCache());
    } catch {
      setCacheError("Unable to clear cached content.");
    } finally {
      setCacheBusy(false);
    }
  };

  const handleClearAllSettings = async () => {
    setResetSettingsError(null);
    if (!resetSettingsConfirming) {
      setResetSettingsConfirming(true);
      return;
    }

    setResetSettingsBusy(true);
    try {
      await onDeleteAllAppData();
      await relaunch().catch(() => {
        window.location.reload();
      });
    } catch {
      setResetSettingsError("Unable to delete all app data.");
      setResetSettingsBusy(false);
      setResetSettingsConfirming(false);
    }
  };

  const handleCreateLocalPlaylist = () => {
    setLocalPlaylistError(null);
    try {
      createLocalPlaylist(localPlaylistName);
      setLocalPlaylistName("");
    } catch (error) {
      setLocalPlaylistError(error instanceof Error ? error.message : "Unable to create local playlist.");
    }
  };

  const handleStartLastFmAuth = async () => {
    setLastFmBusy(true);
    setLastFmError(null);
    try {
      const auth = await LastFmService.startAuth();
      setLastFmAuth(auth);
    } catch (error) {
      setLastFmError(error instanceof Error ? error.message : "Unable to start Last.fm sign-in.");
    } finally {
      setLastFmBusy(false);
    }
  };

  const handleFinishLastFmAuth = async () => {
    if (!lastFmAuth) return;
    setLastFmBusy(true);
    setLastFmError(null);
    try {
      const session = await LastFmService.completeAuth(lastFmAuth.token);
      setLastFmSession(session);
      setLastFmAuth(null);
      setLastFmScrobblingEnabled(true);
    } catch (error) {
      setLastFmError(error instanceof Error ? error.message : "Unable to finish Last.fm sign-in.");
    } finally {
      setLastFmBusy(false);
    }
  };

  const handleDisconnectLastFm = async () => {
    setLastFmBusy(true);
    setLastFmError(null);
    try {
      await LastFmService.disconnect();
      setLastFmSession(null);
      setLastFmAuth(null);
    } catch (error) {
      setLastFmError(error instanceof Error ? error.message : "Unable to disconnect Last.fm.");
    } finally {
      setLastFmBusy(false);
    }
  };

  const handleAddLocalPlaylistPath = (playlistId: string) => {
    setLocalPlaylistError(null);
    const path = localPlaylistPathInputs[playlistId]?.trim() ?? "";
    if (!path) {
      setLocalPlaylistError("Enter a folder path before adding it.");
      return;
    }
    addLocalPlaylistPath(playlistId, path);
    setLocalPlaylistPathInputs((current) => ({ ...current, [playlistId]: "" }));
  };

  const handleBrowseLocalPlaylistPath = async (playlistId: string) => {
    setLocalPlaylistError(null);
    setLocalPlaylistBrowsingId(playlistId);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Choose music folder",
      });
      if (typeof selected !== "string") return;
      addLocalPlaylistPath(playlistId, selected);
      setLocalPlaylistPathInputs((current) => ({
        ...current,
        [playlistId]: "",
      }));
    } catch {
      setLocalPlaylistError("Unable to open the folder picker.");
    } finally {
      setLocalPlaylistBrowsingId(null);
    }
  };

  const handleShortcutCapture = (
    event: KeyboardEvent<HTMLButtonElement>,
    action: KeyboardShortcutAction,
  ) => {
    if (listeningShortcut !== action) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.code === "Escape") {
      setListeningShortcut(null);
      return;
    }

    const shortcut = captureKeyboardShortcut(event.nativeEvent);
    if (!shortcut) return;

    setKeyboardShortcut(action, shortcut);
    setListeningShortcut(null);
  };

  useEffect(() => {
    if (!listeningShortcut) return undefined;

    const handleShortcutKeyDown = (event: globalThis.KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.code === "Escape") {
        setListeningShortcut(null);
        return;
      }

      const shortcut = captureKeyboardShortcut(event);
      if (!shortcut) return;

      setKeyboardShortcut(listeningShortcut, shortcut);
      setListeningShortcut(null);
    };

    window.addEventListener("keydown", handleShortcutKeyDown, true);
    return () => window.removeEventListener("keydown", handleShortcutKeyDown, true);
  }, [listeningShortcut]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-7">
      <header className="flex flex-col gap-1.5">
        <h1>Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, library, appearance, and window behaviour.
        </p>
      </header>

      {/* Vertical nav rather than a pill row: it has room for a description per
          category and scales as sections are added, the way desktop settings do.
          The nav sticks so the categories stay reachable while a long panel scrolls. */}
      <div className="flex min-h-0 flex-1 items-start gap-10">
        <nav
          className="sticky top-0 flex w-56 shrink-0 flex-col gap-0.5"
          role="tablist"
          aria-label="Settings categories"
        >
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "group/tab relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive ? "text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-tab-active"
                    transition={{ type: "spring", stiffness: 520, damping: 42 }}
                    className="absolute inset-0 -z-10 rounded-xl bg-card"
                  />
                )}
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                    isActive ? "bg-primary/15 text-primary" : "bg-card/70 text-muted-foreground",
                  )}
                >
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{tab.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {tab.description}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex min-h-0 w-full min-w-0 max-w-2xl flex-1 flex-col">

      {activeTab === "about" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="About settings">
          <section className={SETTINGS_CARD} aria-labelledby="account-settings-title">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg" id="account-settings-title">Account</h2>
                <p>{isSignedIn ? "Signed in to YouTube Music" : "No account connected"}</p>
              </div>
              <span className={cn("text-sm text-muted-foreground", isSignedIn && "text-primary")}>
                {isSignedIn ? "Connected" : "Signed out"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {account?.artworkUrl ? (
                <img className="size-11 shrink-0 rounded-full object-cover" src={account.artworkUrl} alt="" />
              ) : (
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-muted-foreground">
                  <UserIcon size={30} />
                </div>
              )}

              <div className="flex min-w-0 flex-col">
                <span className="truncate text-base font-medium text-foreground">{account?.name ?? "YouTube Music"}</span>
                <span className="text-sm text-muted-foreground">
                  {isSignedIn ? "Your library and listening history are available." : "Sign in to load your library."}
                </span>
              </div>

              {isSignedIn ? (
                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="button"
                  onClick={() => void libraryController.signOut()}
                >
                  <LogoutIcon size={18} />
                  Sign out
                </button>
              ) : (
                <button
                  className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="button"
                  disabled={authBusy}
                  onClick={() => void onSignIn()}
                >
                  <LoginIcon size={18} />
                  {authBusy ? "Connecting..." : "Sign in"}
                </button>
              )}
            </div>

            {libraryState.error && <p className="text-sm text-destructive">{libraryState.error}</p>}
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="lastfm-settings-title">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg" id="lastfm-settings-title">Last.fm</h2>
                <p>
                  {lastFmSession
                    ? `Connected as ${lastFmSession.username}`
                    : "Connect Last.fm to scrobble your listening history."}
                </p>
              </div>
              <span className={cn("text-sm text-muted-foreground", lastFmSession && "text-primary")}>
                {lastFmSession ? "Connected" : "Signed out"}
              </span>
            </div>

            <div className="flex flex-col gap-5">
              <SettingToggle
                title="Scrobble plays"
                description="Send now playing updates and scrobbles after a track reaches the Last.fm listening threshold."
                checked={lastFmSession ? lastFmScrobblingEnabled : false}
                disabled={!lastFmSession}
                onCheckedChange={setLastFmScrobblingEnabled}
              />

              <div className="flex flex-wrap items-center gap-2">
                <span className={SETTING_LABEL}>
                  <strong>Account connection</strong>
                  <span>
                    {lastFmAuth
                      ? "Approve the connection in your browser, then finish it here."
                      : lastFmSession
                        ? "Disconnecting stops future Last.fm updates from this app."
                        : "A browser window will open so you can approve this app on Last.fm."}
                  </span>
                </span>
                {lastFmSession ? (
                  <button
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={lastFmBusy}
                    onClick={() => void handleDisconnectLastFm()}
                  >
                    <LastFmIcon size={18} />
                    {lastFmBusy ? "Disconnecting..." : "Disconnect"}
                  </button>
                ) : lastFmAuth ? (
                  <button
                    className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={lastFmBusy}
                    onClick={() => void handleFinishLastFmAuth()}
                  >
                    <LastFmIcon size={18} />
                    {lastFmBusy ? "Finishing..." : "Finish connection"}
                  </button>
                ) : (
                  <button
                    className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={lastFmBusy}
                    onClick={() => void handleStartLastFmAuth()}
                  >
                    <LastFmIcon size={18} />
                    {lastFmBusy ? "Opening..." : "Connect Last.fm"}
                  </button>
                )}
              </div>

              {lastFmError && <p className="text-sm text-destructive">{lastFmError}</p>}
            </div>
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="about-settings-title">
            <div className="flex items-center gap-2">
              <h2 className="text-lg" id="about-settings-title">About</h2>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={SETTING_LABEL}>
                  <strong>Updates</strong>
                  <span>
                    Installed version: {
                      installedVersion
                        ? installedVersion === "Unknown" ? installedVersion : `v${installedVersion}`
                        : "Loading..."
                    }
                  </span>
                </span>
                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="button"
                  disabled={updateStatus === "checking"}
                  onClick={() => void handleCheckForUpdates()}
                >
                  <RefreshIcon size={18} />
                  {updateStatus === "checking" ? "Checking..." : "Check for updates"}
                </button>
              </div>

              {updateResult && (
                <div className="flex flex-col gap-1">
                  <span>
                    {updateStatus === "installing"
                      ? updateProgress?.percent !== undefined
                        ? `Downloading version ${updateResult.version}: ${updateProgress.percent}%`
                        : `Preparing version ${updateResult.version}...`
                      : `Version ${updateResult.version} is available.`}
                  </span>
                  {updateResult.canInstall && (
                    <button
                      className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      type="button"
                      disabled={updateStatus === "installing"}
                      onClick={() => void handleInstallUpdate()}
                    >
                      {updateStatus === "installing" ? "Installing..." : "Install"}
                    </button>
                  )}
                  <button
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    onClick={() => void openUrl(updateResult.releaseUrl)}
                  >
                    {updateResult.canInstall ? "View changes" : "Download"}
                  </button>
                </div>
              )}
              {updateStatus === "current" && (
                <p className="text-sm text-muted-foreground">You are up to date.</p>
              )}
              {updateStatus === "error" && (
                <p className="text-sm text-destructive">{updateError}</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className={SETTING_LABEL}>
                  <strong>Quick start</strong>
                  <span>Replay the guided introduction.</span>
                </span>
                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="button"
                  onClick={onRestartOnboarding}
                >
                  <RefreshIcon size={18} />
                  Start onboarding
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "system" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="System settings">
          <section className={SETTINGS_CARD} aria-labelledby="system-settings-title">
            <div className="flex items-center gap-2">
              <h2 className="text-lg" id="system-settings-title">System</h2>
            </div>

            <div className="flex flex-col gap-5">
              <SettingToggle
                title="Launch at startup"
                description="Start Zuno when your computer starts."
                checked={autostartEnabled}
                disabled={autostartLoading}
                onCheckedChange={(checked) => void handleAutostartChange(checked)}
              />

              {autostartError && <p className="text-sm text-destructive">{autostartError}</p>}

              <SettingToggle
                title="Remember window size and location"
                description="Reopen the main window with its last size and screen position."
                checked={mainWindowGeometryPersistenceEnabled}
                onCheckedChange={setMainWindowGeometryPersistenceEnabled}
              />

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <span className={SETTING_LABEL}>
                    <strong>Local playlists</strong>
                    <span>Create playlists from folders on this computer.</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={cn(SETTINGS_FIELD, "w-44")}
                      type="text"
                      value={localPlaylistName}
                      placeholder="Playlist name"
                      aria-label="Local playlist name"
                      onChange={(event) => setLocalPlaylistName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleCreateLocalPlaylist();
                      }}
                    />
                    <button
                      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      type="button"
                      onClick={handleCreateLocalPlaylist}
                    >
                      <FolderAddIcon size={18} />
                      Create
                    </button>
                  </div>
                </div>

                {localPlaylistError && <p className="text-sm text-destructive">{localPlaylistError}</p>}

                {localPlaylists.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {localPlaylists.map((playlist) => (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-background/40 px-3 py-2 text-sm" key={playlist.id}>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-foreground">
                            <FolderIcon size={18} aria-hidden="true" />
                            {playlist.name}
                          </span>
                          <button
                            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            type="button"
                            onClick={() => deleteLocalPlaylist(playlist.id)}
                          >
                            <TrashIcon size={18} />
                            Delete
                          </button>
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="flex items-center gap-2">
                            <input
                              className={cn(SETTINGS_FIELD, "flex-1")}
                              type="text"
                              value={localPlaylistPathInputs[playlist.id] ?? ""}
                              placeholder="/Users/name/Music"
                              aria-label={`Folder path for ${playlist.name}`}
                              onChange={(event) => setLocalPlaylistPathInputs((current) => ({
                                ...current,
                                [playlist.id]: event.target.value,
                              }))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") handleAddLocalPlaylistPath(playlist.id);
                              }}
                            />
                            <button
                              type="button"
                              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                              disabled={localPlaylistBrowsingId === playlist.id}
                              title="Browse for folder"
                              aria-label={`Browse for a folder for ${playlist.name}`}
                              onClick={() => void handleBrowseLocalPlaylistPath(playlist.id)}
                            >
                              <FolderOpenIcon size={17} aria-hidden="true" />
                            </button>
                          </span>
                          <button
                            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            type="button"
                            onClick={() => handleAddLocalPlaylistPath(playlist.id)}
                          >
                            Add
                          </button>
                        </div>

                        {playlist.paths.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {playlist.paths.map((path) => (
                              <div className="flex items-center justify-between gap-3 rounded-lg bg-background/40 px-3 py-2 text-sm" key={path}>
                                <span>{path}</span>
                                <button
                                  type="button"
                                  aria-label={`Remove ${path}`}
                                  onClick={() => removeLocalPlaylistPath(playlist.id, path)}
                                >
                                  <TrashIcon size={16} aria-hidden="true" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-1 py-3 text-sm text-muted-foreground">No paths added yet.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={SETTING_LABEL}>
                  <strong>Application log</strong>
                  <span>Open the current log file for sharing or troubleshooting.</span>
                </span>
                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="button"
                  disabled={logOpening}
                  onClick={() => void handleOpenLog()}
                >
                  <LogFileIcon size={18} />
                  {logOpening ? "Opening..." : "Open log"}
                </button>
              </div>

              {logError && <p className="text-sm text-destructive">{logError}</p>}

              <SettingToggle
                title="Potato PC mode"
                description="Disables animations, blur effects, and the animated star background."
                checked={paperPcMode}
                onCheckedChange={setPaperPcMode}
              />

              <div className="flex flex-wrap items-end justify-between gap-4 py-2">
                <span className={SETTING_LABEL}>
                  <strong>Cache</strong>
                  <span className="tabular-nums">
                    {cacheStats
                      ? `${formatBytes(cacheStats.usedBytes)} of ${formatBytes(cacheStats.maxBytes)}`
                      : "Loading…"}
                    {cacheStats ? ` · ${cacheStats.entryCount} items` : ""}
                  </span>
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {/* The caption sits above the field rather than inside it: nested in a
                      fixed-width pill it wrapped onto two lines and squeezed the number. */}
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Maximum size
                    <span className="flex w-28 items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-sm text-foreground focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring/60">
                      <input
                        className="w-full min-w-0 bg-transparent tabular-nums outline-none"
                        type="number"
                        min="0.25"
                        max="64"
                        step="0.25"
                        value={cacheSizeGb}
                        disabled={cacheBusy}
                        onChange={(event) => setCacheSizeGb(event.target.value)}
                      />
                      <span className="shrink-0 text-muted-foreground">GB</span>
                    </span>
                  </label>
                  <button
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={cacheBusy}
                    onClick={() => void saveCacheSize()}
                  >
                    Save
                  </button>
                  <button
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    disabled={cacheBusy}
                    onClick={() => void handleClearCache()}
                  >
                    <TrashIcon size={18} />
                    Clear cache
                  </button>
                </div>
              </div>

              {cacheError && <p className="text-sm text-destructive">{cacheError}</p>}

              <div className="flex flex-wrap items-center gap-2">
                <span className={SETTING_LABEL}>
                  <strong>Delete all app data</strong>
                  <span>Reset settings, cache, account, queue, tabs, onboarding, and local data.</span>
                </span>
                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="button"
                  disabled={resetSettingsBusy}
                  onClick={() => void handleClearAllSettings()}
                >
                  <TrashIcon size={18} />
                  {resetSettingsBusy
                    ? "Deleting..."
                    : resetSettingsConfirming
                      ? "Press again to confirm"
                      : "Delete everything"}
                </button>
              </div>

              {resetSettingsError && <p className="text-sm text-destructive">{resetSettingsError}</p>}
            </div>
          </section>
        </div>
      )}

      {activeTab === "shortcuts" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="Keyboard shortcut settings">
          <section className={SETTINGS_CARD} aria-labelledby="keyboard-shortcuts-settings-title">
            <div className="flex items-center gap-2">
              <h2 className="text-lg" id="keyboard-shortcuts-settings-title">Keyboard shortcuts</h2>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={SETTING_LABEL}>
                  <strong>Reset shortcuts</strong>
                  <span>Restore every keyboard shortcut to its default.</span>
                </span>
                <button
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  type="button"
                  onClick={resetKeyboardShortcuts}
                >
                  <RefreshIcon size={18} />
                  Reset all
                </button>
              </div>

              {KEYBOARD_SHORTCUT_ACTIONS.map((shortcutAction) => {
                const shortcut = keyboardShortcuts[shortcutAction.id];
                const isListening = listeningShortcut === shortcutAction.id;

                return (
                  <div className="flex items-center justify-between gap-4 py-2" key={shortcutAction.id}>
                    <span className={SETTING_LABEL}>
                      <strong>{shortcutAction.label}</strong>
                      <span>{shortcutAction.description}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className={cn("min-w-32 rounded-lg bg-background px-2.5 py-1.5 text-center text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", isListening && "text-primary")}
                        type="button"
                        aria-pressed={isListening}
                        onClick={() => setListeningShortcut(shortcutAction.id)}
                        onKeyDown={(event) => handleShortcutCapture(event, shortcutAction.id)}
                        onBlur={() => {
                          if (isListening) setListeningShortcut(null);
                        }}
                      >
                        {isListening ? "Press shortcut..." : formatKeyboardShortcut(shortcut)}
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        type="button"
                        onClick={() => resetKeyboardShortcut(shortcutAction.id)}
                      >
                        Reset
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        type="button"
                        disabled={!shortcut}
                        onClick={() => setKeyboardShortcut(shortcutAction.id, null)}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === "window" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="Style settings">
          <section className={SETTINGS_CARD} aria-labelledby="window-settings-title">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg" id="window-settings-title">Window controls</h2>
                <p>Choose the title bar buttons and compact player behavior.</p>
              </div>
              <QueuePanelIcon className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary" size={22} />
            </div>

            <SettingToggle
              title="Mini player"
              description="Show compact playback controls when the main window is not focused."
              checked={miniPlayerEnabled}
              onCheckedChange={setMiniPlayerEnabled}
            />

            <SettingRow
              title="Mini player hover bar"
              description="Choose what the expanded hover slider controls."
            >
              {() => (
                <Select
                  className="w-44"
                  value={miniPlayerHoverAction}
                  onValueChange={(value) =>
                    setMiniPlayerHoverAction(value as MiniPlayerHoverAction)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seek">Song position</SelectItem>
                    <SelectItem value="volume">Volume</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </SettingRow>

            <div className="flex items-center justify-between gap-4 py-2">
              <span className={SETTING_LABEL}>
                <strong>Mini player position</strong>
                <span>Move the mini player back to the bottom center of this screen.</span>
              </span>
              <button
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                type="button"
                disabled={miniPlayerResetting}
                onClick={() => void handleResetMiniPlayerPosition()}
              >
                {miniPlayerResetting ? "Resetting..." : "Reset position"}
              </button>
            </div>

            <SettingToggle
              title="Windows-style controls"
              description="Use minimize, maximize, and close buttons with square edges."
              checked={windowsStyleWindowControls}
              disabled={nativeWindowControls}
              onCheckedChange={setWindowsStyleWindowControls}
            />

            <SettingToggle
              title="Use OS native controls"
              description={isLinux
                ? "Let the operating system draw the window frame and title bar. The app restarts to apply this on Linux."
                : "Let the operating system draw the window frame and title bar."}
              checked={nativeWindowControls}
              onCheckedChange={(checked) => {
                setNativeWindowControls(checked);
                if (isLinux) {
                  void relaunch().catch(() => window.location.reload());
                }
              }}
            />
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="behavior-settings-title">
            <div className="flex items-center gap-2">
              <h2 className="text-lg" id="behavior-settings-title">Behavior</h2>
            </div>

            <SettingToggle
              title="Always show extra controls"
              description="Keep lyrics and queue visible instead of showing them only on hover."
              checked={extraPlayerControlsAlwaysVisible}
              onCheckedChange={setExtraPlayerControlsAlwaysVisible}
            />
          </section>
        </div>
      )}

      {activeTab === "appearance" && (
        <div className="flex flex-col gap-5" role="tabpanel" aria-label="Appearance settings">
          <section className={SETTINGS_CARD} aria-labelledby="theme-settings-title">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                <PaletteIcon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg" id="theme-settings-title">Theme</h2>
                <p className="text-sm text-muted-foreground">
                  Applies instantly across both windows.
                </p>
              </div>
            </div>

            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-labelledby="theme-settings-title"
            >
              {THEME_OPTIONS.map((option) => {
                const isActive = themePreference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setThemePreference(option.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl p-3 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      isActive ? "bg-primary/15" : "bg-background/40 hover:bg-card",
                    )}
                  >
                    {/* Miniature window preview rather than a colour dot — it shows what
                        the choice actually does. */}
                    <span
                      className={cn(
                        "flex h-12 w-full flex-col justify-end overflow-hidden rounded-lg p-1 ring-1",
                        option.swatch,
                        isActive ? "ring-primary" : "ring-black/10",
                      )}
                      aria-hidden="true"
                    >
                      <span
                        className={cn(
                          "h-2 w-full rounded-sm",
                          option.value === "light" ? "bg-neutral-300" : "bg-neutral-700",
                        )}
                      />
                    </span>
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={SETTINGS_CARD} aria-labelledby="motion-settings-title">
            <div className="min-w-0">
              <h2 className="text-lg" id="motion-settings-title">Motion &amp; performance</h2>
              <p className="text-sm text-muted-foreground">
                Turn these off on low-powered machines.
              </p>
            </div>

            <SettingToggle
              title="Reduced motion mode"
              description="Disables animations, blur and shadows across the app."
              checked={paperPcMode}
              onCheckedChange={setPaperPcMode}
            />
          </section>
        </div>
      )}

          {/*
            Support and feedback links live at the foot of the content column rather than as
            a row of filled buttons above the nav. They are destinations you leave the app
            for — quiet text links are the honest weight for that, and it stops them
            competing with the categories for first read.
          */}
          <footer className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <button
              className={SETTINGS_FOOTER_LINK}
              type="button"
              onClick={() => void openUrl(KOFI_URL)}
            >
              <CoffeeIcon size={16} aria-hidden="true" />
              Buy me a coffee
            </button>
            <button
              className={SETTINGS_FOOTER_LINK}
              type="button"
              onClick={() => void openUrl(GITHUB_REPOSITORY_URL)}
            >
              <StarIcon size={16} aria-hidden="true" />
              Star on GitHub
            </button>
            <button
              className={SETTINGS_FOOTER_LINK}
              type="button"
              onClick={() => void openUrl(GITHUB_NEW_ISSUE_URL)}
            >
              <BugIcon size={16} aria-hidden="true" />
              Report an issue
            </button>
          </footer>
        </div>
      </div>
    </main>
  );
}
