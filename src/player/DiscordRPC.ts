import { invoke } from "@tauri-apps/api/core";
import { logInternalDebug, logInternalWarn } from "../internal/logging";
import {
  getDiscordPresenceEnabled,
  setDiscordPresenceEnabled,
} from "../ui/settings/discord";

export interface DiscordPresenceData {
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  songUrl?: string;
  artistUrl?: string;
  albumUrl?: string;
  duration: number; // in seconds
  currentTime: number; // in seconds
  isPlaying: boolean;
}

const DISCORD_TEXT_LIMIT = 128;
const DISCORD_ASSET_URL_LIMIT = 256;
const TRUSTED_ARTWORK_HOSTS = new Set([
  "i.ytimg.com",
  "lh3.googleusercontent.com",
  "yt3.ggpht.com",
]);
const TRUSTED_PRESENCE_LINK_HOSTS = new Set([
  "music.youtube.com",
  "youtube.com",
  "www.youtube.com",
]);

function sanitizeDiscordText(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= DISCORD_TEXT_LIMIT) return text;
  return `${text.slice(0, DISCORD_TEXT_LIMIT - 3)}...`;
}

function sanitizeArtworkUrl(value?: string): string | undefined {
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return undefined;
    if (!TRUSTED_ARTWORK_HOSTS.has(parsed.hostname)) return undefined;
    const url = parsed.toString();
    if (url.length > DISCORD_ASSET_URL_LIMIT) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function sanitizePresenceLink(value?: string): string | undefined {
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return undefined;
    if (!TRUSTED_PRESENCE_LINK_HOSTS.has(parsed.hostname)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function sanitizePresenceData(data: DiscordPresenceData): DiscordPresenceData {
  return {
    title: sanitizeDiscordText(data.title),
    artist: sanitizeDiscordText(data.artist),
    album: sanitizeDiscordText(data.album),
    artworkUrl: sanitizeArtworkUrl(data.artworkUrl),
    songUrl: sanitizePresenceLink(data.songUrl),
    artistUrl: sanitizePresenceLink(data.artistUrl),
    albumUrl: sanitizePresenceLink(data.albumUrl),
    duration: Math.max(0, Math.floor(Number.isFinite(data.duration) ? data.duration : 0)),
    currentTime: Math.max(0, Math.floor(Number.isFinite(data.currentTime) ? data.currentTime : 0)),
    isPlaying: data.isPlaying,
  };
}

/**
 * Manages Discord Rich Presence integration
 * Calls Tauri commands that handle the actual Discord connection in Rust
 */
export class DiscordRpcService {
  /**
   * Read per call rather than cached, so toggling the setting takes effect on the next track
   * update without anything having to notify this service.
   */
  private static get isEnabled(): boolean {
    return getDiscordPresenceEnabled();
  }

  /**
   * Initialize Discord RPC
   * The actual connection happens on the Rust backend
   */
  static async init(): Promise<void> {
    logInternalDebug("Discord.init", { message: "Rust backend will handle connection" });
  }

  /**
   * Stops publishing presence and wipes whatever is already showing.
   *
   * Turning the setting off has to clear as well as stop: presence persists on Discord's side
   * until something replaces it, so without this the last track stays on the user's profile
   * indefinitely — the opposite of what switching it off is asking for.
   */
  static async setEnabled(enabled: boolean): Promise<void> {
    setDiscordPresenceEnabled(enabled);
    if (enabled) return;

    try {
      await invoke("discord_rpc_clear");
      logInternalDebug("Discord.setEnabled cleared presence", {});
    } catch (error) {
      logInternalWarn("Discord.setEnabled.clearFailed", error as Record<string, unknown>);
    }
  }

  /**
   * Update Discord presence with current track information
   * @param data The current track and playback information
   */
  static async updatePresence(data: DiscordPresenceData): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const safeData = sanitizePresenceData(data);
      logInternalDebug("Discord.updatePresence", {
        title: safeData.title,
        artist: safeData.artist,
        isPlaying: safeData.isPlaying,
      });

      // Call Tauri command to update presence in Rust backend
      await invoke("discord_rpc_update", {
        title: safeData.title,
        artist: safeData.artist,
        album: safeData.album,
        artworkUrl: safeData.artworkUrl,
        songUrl: safeData.songUrl,
        artistUrl: safeData.artistUrl,
        albumUrl: safeData.albumUrl,
        duration: safeData.duration,
        currentTime: safeData.currentTime,
        isPlaying: safeData.isPlaying,
      });

      logInternalDebug("Discord.updatePresence.success", {});
    } catch (error) {
      logInternalWarn("Discord.updatePresence.failed", error as Record<string, unknown>);
    }
  }
  /**
   * Clear Discord presence (show as idle)
   */
  static async clearPresence(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      logInternalDebug("Discord.clearPresence", {});
      await invoke("discord_rpc_clear");
      logInternalDebug("Discord.clearPresence.success", {});
    } catch (error) {
      logInternalWarn("Discord.clearPresence.failed", error as Record<string, unknown>);
    }
  }
}

export default DiscordRpcService;
