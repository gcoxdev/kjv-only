import { DOWNLOAD_CACHE_NAME, cacheNameForAsset } from "@/lib/offline-cache";
import { KJV_CORPUS_MANIFEST_URL, parseKjvCorpusManifest } from "@/lib/kjv-corpus-manifest";
import { sha256, type OfflineInventory } from "@/lib/offline-inventory";
import type { Book } from "@/types/bible";
import { bookCodeForIndex } from "@/lib/reader-view";

const FALLBACK_CACHE_CONFIG = {
  cachePrefix: "kjv-only-cache-",
  cacheName: "kjv-only-cache-v10",
} as const;

const APP_SHELL_ASSET_MANIFEST_URL = "/app-shell-assets.json";
const APP_SHELL_ASSET_URL_PATTERN =
  /^\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const OFFLINE_ICON_ASSET_URL_PATTERN =
  /^\/icons\/(?:bw|color)\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.png$/;

type AppShellAssetManifest = {
  schemaVersion: 1;
  startupAssets: string[];
  assets: string[];
  offlineIconAssets: string[];
};

function getAppCacheConfig() {
  return globalThis.KJV_ONLY_CACHE_CONFIG ?? FALLBACK_CACHE_CONFIG;
}

export const CORE_OFFLINE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/sw.js",
  "/theme-init.js",
  "/app-cache-config.js",
  APP_SHELL_ASSET_MANIFEST_URL,
  "/icons/app-icon.svg",
  "/icons/app-icon.png",
  "/icons/app-logo.png",
  "/icons/app-icon-512.png",
  "/icons/app-icon-maskable.png",
  "/icons/pwa-icon-192-transparent.png",
  "/icons/pwa-icon-512-transparent.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon.png",
  "/data/kjv-manifest.json",
  "/data/kjv-bootstrap.json",
  "/data/kjv.json",
  "/references/concordance.compact.delta.min.json",
  "/references/cross-refs.json",
  "/references/websters.json",
  "/references/ai-dictionary.json",
  "/references/hitchcocks.json",
  "/references/bible-word-book.json",
  "/references/old-english.json",
  "/references/phrases.json",
  "/references/units.json",
  "/topics/daily-scripture-topics.json",
  "/topics/topics-index.json",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppShellAssetList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 500 &&
    value.every(
      (url) => typeof url === "string" && APP_SHELL_ASSET_URL_PATTERN.test(url),
    ) &&
    new Set(value).size === value.length
  );
}

function isOfflineIconAssetList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 250 &&
    value.every(
      (url) =>
        typeof url === "string" && OFFLINE_ICON_ASSET_URL_PATTERN.test(url),
    ) &&
    new Set(value).size === value.length
  );
}

export function parseAppShellAssetManifest(value: unknown): AppShellAssetManifest {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isAppShellAssetList(value.startupAssets) ||
    !isAppShellAssetList(value.assets)
  ) {
    throw new Error("Invalid app-shell asset manifest");
  }

  const offlineIconAssets =
    value.offlineIconAssets === undefined ? [] : value.offlineIconAssets;
  if (!isOfflineIconAssetList(offlineIconAssets)) {
    throw new Error("Invalid app-shell asset manifest");
  }

  const assetSet = new Set(value.assets);
  if (!value.startupAssets.every((url) => assetSet.has(url))) {
    throw new Error("Invalid app-shell startup asset");
  }

  return {
    schemaVersion: 1,
    startupAssets: value.startupAssets,
    assets: value.assets,
    offlineIconAssets,
  };
}

export async function loadCoreOfflineUrls() {
  const [response, corpusResponse] = await Promise.all([
    fetch(APP_SHELL_ASSET_MANIFEST_URL, { cache: "no-cache" }),
    fetch(KJV_CORPUS_MANIFEST_URL, { cache: "no-cache" }),
  ]);
  if (!response.ok) {
    throw new Error(`Could not load app-shell assets (HTTP ${response.status})`);
  }
  const manifest = parseAppShellAssetManifest(await response.json());
  if (!corpusResponse.ok) throw new Error(`Could not load Bible download information (HTTP ${corpusResponse.status})`);
  const corpus = parseKjvCorpusManifest(await corpusResponse.json());
  if (!corpus) throw new Error("Invalid Bible download information");
  return Array.from(
    new Set([
      ...CORE_OFFLINE_URLS.map(url => url === "/data/kjv.json" ? (corpus.compact ?? corpus.full).url : url),
      ...manifest.assets,
      ...manifest.offlineIconAssets,
    ]),
  );
}

export function buildAudioUrls(books: Book[], range: "old" | "new") {
  const startIndex = range === "old" ? 0 : 39;
  const endIndex = range === "old" ? Math.min(39, books.length) : books.length;
  const urls: string[] = [];

  for (let bookIndex = startIndex; bookIndex < endIndex; bookIndex += 1) {
    const book = books[bookIndex];
    if (!book) {
      continue;
    }
    const code = bookCodeForIndex(bookIndex);
    for (
      let chapterIndex = 0;
      chapterIndex < book.chapters.length;
      chapterIndex += 1
    ) {
      urls.push(`/audio/${code}.${chapterIndex + 1}.mp3`);
    }
  }

  return urls;
}

export function normalizeOfflineAssetUrl(url: string) {
  const resolved = new URL(url, window.location.origin);
  return `${resolved.pathname}${resolved.search}`;
}

export async function resolveAppCacheName() {
  return getAppCacheConfig().cacheName;
}

export async function openAppCache() {
  const cacheName = await resolveAppCacheName();
  return caches.open(cacheName);
}

export async function clearAppOfflineCaches() {
  const cacheNames = await caches.keys();
  const { cachePrefix } = getAppCacheConfig();
  const appCacheNames = cacheNames.filter((cacheName) =>
    cacheName.startsWith(cachePrefix) || cacheName === DOWNLOAD_CACHE_NAME,
  );
  await Promise.all(appCacheNames.map((cacheName) => caches.delete(cacheName)));
}

export async function getCachedOfflineAssetKeys() {
  const stores = await Promise.all([openAppCache(), caches.open(DOWNLOAD_CACHE_NAME)]);
  const requests = (await Promise.all(stores.map(cache => cache.keys()))).flat();
  return new Set(
    requests.map((request) => normalizeOfflineAssetUrl(request.url)),
  );
}

type DownloadOfflineAssetBatchOptions = {
  forceRefresh?: boolean;
  inventory?: OfflineInventory | null;
};

export async function downloadOfflineAssetBatch(
  urls: string[],
  options?: DownloadOfflineAssetBatchOptions,
  onProgress?: (completed: number, total: number, failures: string[]) => void,
) {
  const cachedKeys = await getCachedOfflineAssetKeys();
  const failures: string[] = [];
  let completed = 0;
  let verified = 0;
  const total = urls.length;

  for (const url of urls) {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    const normalizedKey = normalizeOfflineAssetUrl(absoluteUrl);

    if (!options?.forceRefresh && cachedKeys.has(normalizedKey)) {
      completed += 1;
      onProgress?.(completed, total, failures);
      continue;
    }

    try {
      const response = await fetch(absoluteUrl, { cache: "reload" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const expected = options?.inventory?.assets[new URL(absoluteUrl).pathname];
      if (expected) {
        const bytes = await response.clone().arrayBuffer();
        if (bytes.byteLength !== expected.bytes || await sha256(bytes) !== expected.sha256) {
          throw new Error("The download does not match the current bundle. Reload download information and try again.");
        }
      }
      const cache = await caches.open(cacheNameForAsset(absoluteUrl));
      await cache.put(absoluteUrl, response.clone());
      if (expected) verified += 1;
      cachedKeys.add(normalizedKey);
    } catch {
      failures.push(url);
    }

    completed += 1;
    onProgress?.(completed, total, failures);
  }

  return { failures, verified };
}

export async function deleteOfflineAssetBatch(urls: string[]) {
  const stores = await Promise.all([openAppCache(), caches.open(DOWNLOAD_CACHE_NAME)]);
  // Clearing Core Bible Data also clears the legacy fallback retained on upgrade.
  const targets = new Set(urls);
  if (targets.has(KJV_CORPUS_MANIFEST_URL)) {
    targets.add("/data/kjv.json");
    targets.add("/data/kjv-compact-v1.json");
  }
  for (const url of targets) {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    await Promise.all(stores.map(cache => cache.delete(absoluteUrl, {
      ignoreSearch: false,
      ignoreVary: true,
    })));
  }
}

export function formatOfflineBytes(value: number | null | undefined) {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
