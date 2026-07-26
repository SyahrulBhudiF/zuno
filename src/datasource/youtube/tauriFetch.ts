import { invoke } from "@tauri-apps/api/core";
import { logInternalDebug, logInternalError, logInternalInfo } from "../../internal/logging";

type ProxyHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body_base64: string;
};

type TauriFetchInit = RequestInit & {
  timeoutMs?: number;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getSafeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey === "authorization"
        || normalizedKey === "cookie"
        || normalizedKey === "set-cookie"
      ) {
        return [key, "[redacted]"];
      }
      return [key, value];
    }),
  );
}

function summarizeRequestBody(bodyBase64: string | undefined): Record<string, unknown> | null {
  if (!bodyBase64) return null;
  try {
    const text = new TextDecoder().decode(fromBase64(bodyBase64));
    const json = JSON.parse(text) as Record<string, unknown>;
    const context = json.context as {
      client?: { clientName?: string; clientVersion?: string };
    } | undefined;
    return {
      byteLength: text.length,
      topLevelKeys: Object.keys(json),
      browseId: json.browseId,
      hasContinuation: typeof json.continuation === "string",
      clientName: context?.client?.clientName,
      clientVersion: context?.client?.clientVersion,
    };
  } catch {
    return {
      byteLength: fromBase64(bodyBase64).byteLength,
      format: "non-json",
    };
  }
}

function getRequestUrl(inputUrl: string, headers: Record<string, string>): string {
  const url = new URL(inputUrl);
  const clientName = headers["x-youtube-client-name"];

  if (
    clientName === "67"
    && url.hostname === "www.youtube.com"
    && url.pathname.startsWith("/youtubei/")
  ) {
    url.hostname = "music.youtube.com";
  }

  return url.toString();
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = part.trim().split("=");
    if (cookieName === name) return valueParts.join("=");
  }
  return null;
}

function getSapisidAuthCookie(cookieHeader: string | undefined): string | null {
  return getCookieValue(cookieHeader, "SAPISID")
    ?? getCookieValue(cookieHeader, "__Secure-1PAPISID")
    ?? getCookieValue(cookieHeader, "__Secure-3PAPISID");
}

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Signs an InnerTube request with the SAPISIDHASH the cookie session requires.
 *
 * The hash is bound to the origin it is sent to, so the origin here has to match the host the
 * request actually goes to — see getRequestUrl, which redirects WEB_REMIX traffic to
 * music.youtube.com. Everything else stays on www.youtube.com.
 *
 * This used to bail out for anything that was not WEB_REMIX, which meant plain WEB requests
 * went out unsigned and YouTube answered them as if signed out. The channel-switcher endpoint
 * is WEB-only, so it always came back as a signed-out stub with no accounts in it.
 */
async function applyCookieAuth(
  headers: Record<string, string>,
  requestUrl: string,
): Promise<void> {
  // InnerTube API calls only. Signing an ordinary page or media fetch would rewrite its
  // Origin and Referer to a host it is not going to, which is worse than leaving it alone.
  if (!headers.cookie || !new URL(requestUrl).pathname.startsWith("/youtubei/")) return;

  const origin = headers["x-youtube-client-name"] === "67"
    ? "https://music.youtube.com"
    : "https://www.youtube.com";
  const sapisid = getSapisidAuthCookie(headers.cookie);
  if (sapisid) {
    const timestamp = Math.floor(Date.now() / 1000);
    const hash = await sha1Hex(`${timestamp} ${sapisid} ${origin}`);
    headers.authorization = `SAPISIDHASH ${timestamp}_${hash}`;
    headers["x-goog-request-time"] = timestamp.toString();
  }
  headers.origin = origin;
  headers["x-origin"] = origin;
  headers.referer = `${origin}/`;
}

async function buildBodyBase64(input: RequestInfo | URL, init?: RequestInit): Promise<string | undefined> {
  const body = init?.body;
  if (!body) return undefined;

  if (typeof body === "string") {
    return toBase64(new TextEncoder().encode(body));
  }

  if (body instanceof URLSearchParams) {
    return toBase64(new TextEncoder().encode(body.toString()));
  }

  if (body instanceof Uint8Array) {
    return toBase64(body);
  }

  if (body instanceof ArrayBuffer) {
    return toBase64(new Uint8Array(body));
  }

  if (body instanceof Blob) {
    return toBase64(new Uint8Array(await body.arrayBuffer()));
  }

  if (typeof input !== "string" && !(input instanceof URL) && input.body) {
    const fallbackBuffer = await input.clone().arrayBuffer();
    return toBase64(new Uint8Array(fallbackBuffer));
  }

  return undefined;
}

export async function tauriFetch(input: RequestInfo | URL, init?: TauriFetchInit): Promise<Response> {
  const startedAt = performance.now();
  let sourceHeaders: HeadersInit | undefined;
  
  if (init?.headers) {
    sourceHeaders = init.headers;
  } else if (typeof input !== "string" && !(input instanceof URL) && input.headers) {
    sourceHeaders = input.headers;
  }
  
  const requestHeaders = new Headers(sourceHeaders);

  const headers: Record<string, string> = {};
  requestHeaders.forEach((value, key) => {
    headers[key] = value;
  });
  // Signed before the URL is resolved, because getRequestUrl keys off the client name that
  // decides the origin the signature is bound to.
  await applyCookieAuth(headers, normalizeUrl(input));
  const method =
    init?.method ??
    (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET");
  const body_base64 = await buildBodyBase64(input, init);
  const url = getRequestUrl(normalizeUrl(input), headers);

  logInternalInfo("tauriFetch.request", {
    method,
    url,
    headerCount: Object.keys(headers).length,
    hasBody: Boolean(body_base64),
    headers: getSafeHeaders(headers),
    bodySummary: summarizeRequestBody(body_base64),
    urlDomain: new URL(url).hostname,
    urlPath: new URL(url).pathname,
  });

  try {
    const proxyResponse = await invoke<ProxyHttpResponse>("proxy_http_request", {
      input: {
        url,
        method,
        headers,
        body_base64,
        timeout_ms: init?.timeoutMs,
      },
    });

    if (!proxyResponse) {
      throw new Error("Tauri proxy_http_request returned undefined response");
    }

    const bodyBytes = fromBase64(proxyResponse.body_base64);
    if (proxyResponse.status >= 400) {
      logInternalError("tauriFetch.http error", new Error(`HTTP ${proxyResponse.status}`), {
        method,
        url,
        responseBody: new TextDecoder().decode(bodyBytes).slice(0, 1000),
      });
    }
    logInternalDebug("tauriFetch.response", {
      method,
      url,
      status: proxyResponse.status,
      responseHeaderCount: Object.keys(proxyResponse.headers).length,
      responseHeaders: getSafeHeaders(proxyResponse.headers),
      responseBytes: bodyBytes.byteLength,
      durationMs: Math.round(performance.now() - startedAt),
      success: proxyResponse.status >= 200 && proxyResponse.status < 300,
    });
    const responseBody = proxyResponse.status === 204
      || proxyResponse.status === 205
      || proxyResponse.status === 304
      ? null
      : bodyBytes;
    return new Response(responseBody, {
      status: proxyResponse.status,
      headers: proxyResponse.headers,
    });
  } catch (error) {
    logInternalError("tauriFetch.invoke failed", error, {
      method,
      url,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw error;
  }
}
