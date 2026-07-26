/*
 * Which InnerTube client yields a googlevideo URL that actually downloads?
 *
 * Run outside the app on purpose: same egress IP, same YouTube view, but no webview, no
 * cookies and no session state, so the only variable is the client type.
 */
import { Innertube, ClientType, UniversalCache } from "youtubei.js";

const VIDEO_IDS = process.argv.slice(2);
if (VIDEO_IDS.length === 0) VIDEO_IDS.push("kZFAMV6vw9Y");

const CLIENTS = [
  "MUSIC",
  "WEB",
  "TV_EMBEDDED",
  "IOS",
  "ANDROID_VR",
  "ANDROID",
  "WEB_EMBEDDED",
  "TV",
  "MWEB",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function resolve(clientName, videoId) {
  const yt = await Innertube.create({
    client_type: ClientType[clientName],
    retrieve_player: true,
    generate_session_locally: true,
    cache: new UniversalCache(false),
  });

  const info = await yt.getBasicInfo(videoId);
  const audio = (info.streaming_data?.adaptive_formats ?? []).filter((format) =>
    typeof format.mime_type === "string" && format.mime_type.startsWith("audio/"),
  );
  if (audio.length === 0) throw new Error("no audio formats offered");

  // Highest bitrate, matching what the app's "high" quality lands on.
  const format = audio.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
  const url = typeof format.url === "string" && format.url
    ? format.url
    : await format.decipher(yt.session.player);
  if (!url) throw new Error("empty url");

  return { url, itag: format.itag, bitrate: format.bitrate, mime: format.mime_type };
}

async function tryFetch(url, videoId) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Range: "bytes=0-16383",
      Origin: "https://www.youtube.com",
      Referer: `https://www.youtube.com/watch?v=${videoId}`,
    },
  });
  const body = await response.arrayBuffer().catch(() => new ArrayBuffer(0));
  return { status: response.status, bytes: body.byteLength };
}

for (const videoId of VIDEO_IDS) {
  console.log(`\n=== ${videoId} ===`);
  for (const clientName of CLIENTS) {
    try {
      const { url, itag, bitrate, mime } = await resolve(clientName, videoId);
      const hasPot = new URL(url).searchParams.has("pot");
      const { status, bytes } = await tryFetch(url, videoId);
      console.log(
        `${clientName.padEnd(13)} itag=${String(itag).padEnd(4)} ${String(bitrate).padEnd(7)} pot=${hasPot ? "yes" : "no "} -> HTTP ${status} bytes=${bytes} ${mime?.slice(0, 22) ?? ""}`,
      );
    } catch (error) {
      console.log(`${clientName.padEnd(13)} FAILED: ${error?.message ?? error}`);
    }
  }
}
