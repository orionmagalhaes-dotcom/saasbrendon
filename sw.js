const CACHE_NAME = "restobar-cache-v10";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./brand-logo.png",
  "./brand-login.png"
];
const STATIC_EXTENSIONS = [".html", ".css", ".js", ".webmanifest", ".svg", ".png", ".jpg", ".jpeg", ".ico"];
const API_PATH_PREFIXES = ["/rest/v1/", "/auth/v1/", "/realtime/v1/", "/storage/v1/"];
const ASSET_PATHS = new Set(ASSETS.map((asset) => new URL(asset, self.location.origin).pathname));

function isCacheableStaticRequest(request) {
  if (!request || request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (API_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return false;
  if (url.pathname === "/" || ASSET_PATHS.has(url.pathname)) return true;
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

function isRuntimeCriticalRequest(request) {
  if (!request || request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return url.pathname.endsWith("/app.js") || url.pathname.endsWith("/styles.css") || url.pathname.endsWith("/index.html");
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_err) {
    if (request.destination === "document") {
      return (await caches.match("./index.html")) || Response.error();
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function networkFirstStatic(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.destination === "document") {
      return (await caches.match("./index.html")) || Response.error();
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }
  if (!isCacheableStaticRequest(request)) return;
  if (isRuntimeCriticalRequest(request)) {
    event.respondWith(networkFirstStatic(request));
    return;
  }
  event.respondWith(cacheFirstStatic(request));
});
