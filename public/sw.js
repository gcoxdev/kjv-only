const workerUrl = new URL(self.location.href)
const BUILD_CACHE_NAME = null // Replaced by the production build.
const APP_CACHE = BUILD_CACHE_NAME || workerUrl.searchParams.get("cacheName")
const DOWNLOAD_CACHE = "kjv-only-downloads-v1"
const NETWORK_TIMEOUT_MS = 3500
function isDownloadPath(path) {
  return /^\/(?:audio|data|references|maps|topics)\//.test(path) || path === "/offline-inventory.json"
}
function cacheForRequest(request) {
  return caches.open(isDownloadPath(new URL(request.url).pathname) ? DOWNLOAD_CACHE : APP_CACHE)
}
const APP_CACHE_PREFIX = workerUrl.searchParams.get("cachePrefix")
const CACHE_TOKEN_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/
if (
  !APP_CACHE ||
  !APP_CACHE_PREFIX ||
  !CACHE_TOKEN_PATTERN.test(APP_CACHE) ||
  !CACHE_TOKEN_PATTERN.test(APP_CACHE_PREFIX) ||
  !APP_CACHE.startsWith(APP_CACHE_PREFIX)
) {
  throw new Error("Invalid service-worker cache configuration")
}
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/theme-init.js",
  "/app-cache-config.js",
  "/app-shell-assets.json",
  "/data/kjv-manifest.json",
  "/data/kjv-bootstrap.json",
  "/icons/app-icon.svg",
  "/icons/app-icon.png",
  "/icons/app-logo.png",
  "/icons/app-icon-512.png",
  "/icons/app-icon-maskable.png",
  "/icons/pwa-icon-192-transparent.png",
  "/icons/pwa-icon-512-transparent.png",
  "/icons/pwa-icon-192-maskable-v2.png",
  "/icons/pwa-icon-512-maskable-v2.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon.png",
  "/topics/daily-scripture-topics.json",
]
const APP_SHELL_ASSET_URL_PATTERN =
  /^\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/
const OFFLINE_ICON_ASSET_URL_PATTERN =
  /^\/icons\/(?:bw|color)\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.png$/
const LIVE_DATA_PREFIXES = ["/references/", "/data/", "/maps/", "/topics/"]
const NETWORK_FIRST_PATHS = new Set([
  "/offline-inventory.json",
  "/theme-init.js",
  "/app-cache-config.js",
  "/app-shell-assets.json",
])

function shouldUseNetworkFirst(requestUrl) {
  return (
    NETWORK_FIRST_PATHS.has(requestUrl.pathname) ||
    LIVE_DATA_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix))
  )
}

function isRangedRequest(request) {
  const rangeHeader = request.headers.get("range")
  return typeof rangeHeader === "string" && rangeHeader.trim().length > 0
}

function shouldCacheResponse(response) {
  return response.status === 200
}

function isAssetList(value) {
  return (
    Array.isArray(value) &&
    value.length <= 500 &&
    value.every(
      (url) => typeof url === "string" && APP_SHELL_ASSET_URL_PATTERN.test(url)
    ) &&
    new Set(value).size === value.length
  )
}

function isOfflineIconAssetList(value) {
  return (
    Array.isArray(value) &&
    value.length <= 250 &&
    value.every(
      (url) =>
        typeof url === "string" && OFFLINE_ICON_ASSET_URL_PATTERN.test(url)
    ) &&
    new Set(value).size === value.length
  )
}

async function cacheAppShell() {
  const cache = await caches.open(APP_CACHE)
  await cache.addAll(APP_SHELL)
  const response = await cache.match("/app-shell-assets.json")
  const manifest = await response?.json()
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    !isAssetList(manifest.startupAssets) ||
    !isAssetList(manifest.assets)
  ) {
    throw new Error("Invalid app-shell asset manifest")
  }
  const offlineIconAssets = manifest.offlineIconAssets ?? []
  if (!isOfflineIconAssetList(offlineIconAssets)) {
    throw new Error("Invalid offline icon asset manifest")
  }
  const assetSet = new Set(manifest.assets)
  if (!manifest.startupAssets.every((url) => assetSet.has(url))) {
    throw new Error("Invalid app-shell startup asset")
  }
  await cache.addAll(
    Array.from(new Set([...manifest.assets, ...offlineIconAssets]))
  )
}

function sameCacheVersion(cached, response) {
  if (!cached || !response.ok) return false
  const etag = response.headers.get("etag")
  if (etag) return etag === cached.headers.get("etag")
  const modified = response.headers.get("last-modified")
  const length = response.headers.get("content-length")
  return Boolean(modified && length && modified === cached.headers.get("last-modified") && length === cached.headers.get("content-length"))
}

async function networkFirst(request, event, navigation = false) {
  const cache = await (navigation ? caches.open(APP_CACHE) : cacheForRequest(request))
  const key = navigation ? "/index.html" : request
  const cached = await cache.match(key, { ignoreVary: true }) || (!navigation && isDownloadPath(new URL(request.url).pathname)
    ? await (await caches.open(APP_CACHE)).match(request, { ignoreVary: true }) : undefined)
  const network = fetch(request).then(response => {
    if (shouldCacheResponse(response) && !sameCacheVersion(cached, response)) {
      const copy = response.clone()
      event.waitUntil(cache.put(key, copy).catch(() => {}))
    }
    return response.status >= 500 && cached ? cached : response
  }).catch(() => cached || Response.error())
  // Keep the request alive to refresh the cache even after a timed fallback.
  event.waitUntil(network.then(() => {}))
  if (!cached) return network
  let timer
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS) })
  try { return await Promise.race([network, timeout]) }
  finally { clearTimeout(timer) }
}

async function cacheFirst(request, requestUrl) {
  const cache = await cacheForRequest(request)
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) {
    return cached
  }

  let response
  try {
    response = await fetch(request)
  } catch {
    if (OFFLINE_ICON_ASSET_URL_PATTERN.test(requestUrl.pathname)) {
      const fallback = await cache.match("/icons/app-icon.svg", {
        ignoreVary: true,
      })
      if (fallback) {
        return fallback
      }
    }
    return Response.error()
  }
  if (shouldCacheResponse(response)) {
    try {
      await cache.put(request, response.clone())
    } catch {
      // Continue serving the fetched response when persistent storage is full.
    }
  }
  return response
}

function prepareClientForUpdate(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const finish = () => {
      clearTimeout(timeoutId)
      channel.port1.close()
      resolve()
    }
    const timeoutId = setTimeout(finish, 1500)
    channel.port1.onmessage = finish
    client.postMessage(
      { type: "KJV_ONLY_UPDATE_ACTIVATING" },
      [channel.port2]
    )
  })
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell())
})

self.addEventListener("message", (event) => {
  if (
    !event.data ||
    typeof event.data !== "object" ||
    event.data.type !== "KJV_ONLY_SKIP_WAITING"
  ) {
    return
  }
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => Promise.all(clients.map(prepareClientForUpdate)))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const downloads = await caches.open(DOWNLOAD_CACHE)
    for (const name of await caches.keys()) {
      if (!name.startsWith(APP_CACHE_PREFIX) || name === APP_CACHE) continue
      const old = await caches.open(name)
      for (const request of await old.keys()) {
        if (!isDownloadPath(new URL(request.url).pathname)) continue
        if (await downloads.match(request, { ignoreVary: true })) continue
        const response = await old.match(request, { ignoreVary: true })
        if (response?.status === 200) await downloads.put(request, response)
      }
      // Never delete an old cache if migration failed (e.g. storage quota).
      await caches.delete(name)
    }
    await self.clients.claim()
  })())
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) {
    return
  }

  // Leave partial media transfers to the browser's native network stack.
  // Forwarding them with respondWith(fetch(...)) adds an unnecessary worker
  // boundary; we do not serve or cache partial responses here.
  if (isRangedRequest(event.request)) {
    return
  }

  // Explicit refreshes must reach the server and must fail when offline.
  if (event.request.cache === "reload") {
    event.respondWith(fetch(event.request))
    return
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, event, true))
    return
  }

  if (shouldUseNetworkFirst(requestUrl)) {
    event.respondWith(networkFirst(event.request, event))
    return
  }

  event.respondWith(cacheFirst(event.request, requestUrl))
})
