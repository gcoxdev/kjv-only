// Keep user downloads outside the versioned app-shell cache.
export const DOWNLOAD_CACHE_NAME = "kjv-only-downloads-v1";
export function isDownloadPath(path: string) {
  return /^\/(?:audio|data|references|maps|topics)\//.test(path) || path === "/offline-inventory.json";
}
export function appShellCacheName() {
  return globalThis.KJV_ONLY_CACHE_CONFIG?.cacheName ?? "kjv-only-cache-v10";
}
export function cacheNameForAsset(url: string) {
  return isDownloadPath(new URL(url, "https://reader.invalid").pathname) ? DOWNLOAD_CACHE_NAME : appShellCacheName();
}
