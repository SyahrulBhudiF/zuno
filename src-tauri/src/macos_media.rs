use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject};
use objc2::{class, msg_send};
use objc2_foundation::{NSMutableDictionary, NSNumber, NSString};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

const MEDIA_CONTROL_EVENT: &str = "macos-media-control";
const COMMAND_SUCCESS: isize = 0;

/// `MPNowPlayingPlaybackState`. macOS decides the Now Playing app from this, so without it the
/// media keys go elsewhere and none of the handlers below ever fire.
const PLAYBACK_STATE_PLAYING: usize = 1;
const PLAYBACK_STATE_PAUSED: usize = 2;
const PLAYBACK_STATE_STOPPED: usize = 3;

/// Matches the object arm of `NativeMediaAction` in useMediaSession.ts. `Clone` for `emit`.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SeekAction {
    action: &'static str,
    position_sec: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSessionUpdate {
    title: Option<String>,
    artist: Option<String>,
    artwork_url: Option<String>,
    status: String,
    duration_sec: Option<f64>,
    position_sec: Option<f64>,
}

pub struct MacosMediaSession(Mutex<bool>);

unsafe impl Send for MacosMediaSession {}
unsafe impl Sync for MacosMediaSession {}

#[link(name = "MediaPlayer", kind = "framework")]
extern "C" {
    static MPMediaItemPropertyTitle: *const NSString;
    static MPMediaItemPropertyArtist: *const NSString;
    static MPMediaItemPropertyPlaybackDuration: *const NSString;
    static MPNowPlayingInfoPropertyElapsedPlaybackTime: *const NSString;
    static MPNowPlayingInfoPropertyPlaybackRate: *const NSString;
}

impl MacosMediaSession {
    pub fn new() -> Self {
        Self(Mutex::new(false))
    }

    fn ensure_handlers(&self, app: &AppHandle) -> Result<(), String> {
        let mut initialized = self.0.lock().map_err(|error| error.to_string())?;
        if *initialized {
            return Ok(());
        }

        install_remote_command_handler(app, "playCommand", "play")?;
        install_remote_command_handler(app, "pauseCommand", "pause")?;
        // The Play/Pause key on Apple keyboards, the Touch Bar and headphone buttons all send
        // this rather than play or pause.
        install_remote_command_handler(app, "togglePlayPauseCommand", "playPause")?;
        install_remote_command_handler(app, "nextTrackCommand", "next")?;
        install_remote_command_handler(app, "previousTrackCommand", "previous")?;
        install_position_command_handler(app)?;
        *initialized = true;
        Ok(())
    }

    fn update(&self, app: &AppHandle, update: MediaSessionUpdate) -> Result<(), String> {
        self.ensure_handlers(app)?;
        set_now_playing_info(update);
        Ok(())
    }
}

fn command_center() -> *mut AnyObject {
    let class: &AnyClass = class!(MPRemoteCommandCenter);
    unsafe { msg_send![class, sharedCommandCenter] }
}

fn now_playing_info_center() -> *mut AnyObject {
    let class: &AnyClass = class!(MPNowPlayingInfoCenter);
    unsafe { msg_send![class, defaultCenter] }
}

fn install_remote_command_handler(
    app: &AppHandle,
    command_selector: &str,
    action: &'static str,
) -> Result<(), String> {
    let center = command_center();
    if center.is_null() {
        return Err("macOS remote command center unavailable".to_string());
    }

    let command: *mut AnyObject = unsafe {
        match command_selector {
            "playCommand" => msg_send![center, playCommand],
            "pauseCommand" => msg_send![center, pauseCommand],
            "togglePlayPauseCommand" => msg_send![center, togglePlayPauseCommand],
            "nextTrackCommand" => msg_send![center, nextTrackCommand],
            "previousTrackCommand" => msg_send![center, previousTrackCommand],
            _ => {
                return Err(format!(
                    "unsupported macOS media command: {command_selector}"
                ))
            }
        }
    };

    if command.is_null() {
        return Err(format!(
            "macOS media command unavailable: {command_selector}"
        ));
    }

    let app = app.clone();
    let block = RcBlock::new(move |_event: *mut AnyObject| {
        let _ = app.emit(MEDIA_CONTROL_EVENT, action);
        COMMAND_SUCCESS
    });

    unsafe {
        let _: () = msg_send![command, setEnabled: true];
        let _: *mut AnyObject = msg_send![command, addTargetWithHandler: &*block];
    }

    std::mem::forget(block);
    Ok(())
}

/// Separate from the handler above because this one reads `positionTime` off the event, which
/// is what drives the Control Center scrubber.
fn install_position_command_handler(app: &AppHandle) -> Result<(), String> {
    let center = command_center();
    if center.is_null() {
        return Err("macOS remote command center unavailable".to_string());
    }

    let command: *mut AnyObject = unsafe { msg_send![center, changePlaybackPositionCommand] };
    if command.is_null() {
        return Err("macOS media command unavailable: changePlaybackPositionCommand".to_string());
    }

    let app = app.clone();
    let block = RcBlock::new(move |event: *mut AnyObject| {
        if event.is_null() {
            return COMMAND_SUCCESS;
        }
        let position_sec: f64 = unsafe { msg_send![event, positionTime] };
        if position_sec.is_finite() {
            let _ = app.emit(
                MEDIA_CONTROL_EVENT,
                SeekAction { action: "seekTo", position_sec: position_sec.max(0.0) },
            );
        }
        COMMAND_SUCCESS
    });

    unsafe {
        let _: () = msg_send![command, setEnabled: true];
        let _: *mut AnyObject = msg_send![command, addTargetWithHandler: &*block];
    }

    std::mem::forget(block);
    Ok(())
}

/// Set after `nowPlayingInfo`, which is the order Apple documents.
fn set_playback_state(center: *mut AnyObject, state: usize) {
    if center.is_null() {
        return;
    }
    unsafe {
        let _: () = msg_send![center, setPlaybackState: state];
    }
}

fn set_now_playing_info(update: MediaSessionUpdate) {
    let center = now_playing_info_center();
    if center.is_null() {
        return;
    }

    let Some(title) = update.title else {
        let nil_info: *mut AnyObject = std::ptr::null_mut();
        unsafe {
            let _: () = msg_send![center, setNowPlayingInfo: nil_info];
        }
        set_playback_state(center, PLAYBACK_STATE_STOPPED);
        return;
    };

    let info = NSMutableDictionary::<NSString, AnyObject>::dictionaryWithCapacity(6);
    insert_string(&info, unsafe { &*MPMediaItemPropertyTitle }, &title);

    if let Some(artist) = update.artist {
        insert_string(&info, unsafe { &*MPMediaItemPropertyArtist }, &artist);
    }

    if let Some(duration) = update.duration_sec.filter(|duration| duration.is_finite()) {
        insert_number(
            &info,
            unsafe { &*MPMediaItemPropertyPlaybackDuration },
            duration.max(0.0),
        );
    }

    if let Some(position) = update.position_sec.filter(|position| position.is_finite()) {
        insert_number(
            &info,
            unsafe { &*MPNowPlayingInfoPropertyElapsedPlaybackTime },
            position.max(0.0),
        );
    }

    let is_playing = update.status == "playing";
    insert_number(
        &info,
        unsafe { &*MPNowPlayingInfoPropertyPlaybackRate },
        if is_playing { 1.0 } else { 0.0 },
    );

    let _ = update.artwork_url;

    unsafe {
        let _: () = msg_send![center, setNowPlayingInfo: &*info];
    }

    // "loading" counts as playing: it is a track starting, and reporting stopped mid-handover
    // hands the media keys to another app.
    set_playback_state(
        center,
        match update.status.as_str() {
            "playing" | "loading" => PLAYBACK_STATE_PLAYING,
            "paused" => PLAYBACK_STATE_PAUSED,
            _ => PLAYBACK_STATE_STOPPED,
        },
    );
}

fn insert_string(info: &NSMutableDictionary<NSString, AnyObject>, key: &NSString, value: &str) {
    let value = NSString::from_str(value);
    let value: Retained<AnyObject> = value.into();
    info.insert(key, &value);
}

fn insert_number(info: &NSMutableDictionary<NSString, AnyObject>, key: &NSString, value: f64) {
    let value = NSNumber::new_f64(value);
    let value: Retained<AnyObject> = value.into();
    info.insert(key, &value);
}

#[tauri::command]
pub fn update_macos_media_session(
    app: AppHandle,
    state: tauri::State<'_, MacosMediaSession>,
    update: MediaSessionUpdate,
) -> Result<(), String> {
    state.update(&app, update)
}
