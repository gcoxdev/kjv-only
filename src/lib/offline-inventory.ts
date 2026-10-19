import { DOWNLOAD_CACHE_NAME } from "@/lib/offline-cache";
import { readLocalStorageJson, writeLocalStorageJson } from '@/lib/local-storage';
export type OfflineAsset = { bytes: number; sha256: string };
export type OfflineInventory = { schemaVersion: 1; mapUrls?: string[]; assets: Record<string, OfflineAsset> };
export type BundleReceipt = { version: string; refreshedAt: number };
const HISTORY_KEY = 'kjv-offline-bundle-history-v1';
const HASH = /^[a-f0-9]{64}$/;

export function parseOfflineInventory(value: unknown): OfflineInventory {
  if (!value || typeof value !== 'object' || !('schemaVersion' in value) || value.schemaVersion !== 1 ||
      !('assets' in value) || !value.assets || typeof value.assets !== 'object' || Array.isArray(value.assets)) throw new Error('Invalid download information');
  const assets: Record<string, OfflineAsset> = Object.create(null);
  const entries = Object.entries(value.assets);
  if (entries.length > 10000) throw new Error('Invalid download information');
  for (const [url, asset] of entries) {
    if (!/^\/(?:[A-Za-z0-9._/-]*)$/.test(url) || url.includes('..') || url.startsWith('//') || !asset ||
        typeof asset !== 'object' || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 ||
        typeof asset.sha256 !== 'string' || !HASH.test(asset.sha256)) throw new Error('Invalid download information');
    assets[url] = { bytes: asset.bytes, sha256: asset.sha256 };
  }
  const mapUrls = 'mapUrls' in value ? value.mapUrls : undefined;
  if (mapUrls !== undefined && (!Array.isArray(mapUrls) || mapUrls.length > 10000 ||
      !mapUrls.includes('/maps/data/map.json') || new Set(mapUrls).size !== mapUrls.length ||
      !mapUrls.every((url) => typeof url === 'string' && (url === '/maps/data/map.json' || /^\/maps\/geometry\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.geojson$/.test(url)) && assets[url]))) {
    throw new Error('Invalid map download information');
  }
  return { schemaVersion: 1, assets, ...(mapUrls ? { mapUrls: mapUrls as string[] } : {}) };
}

export async function sha256(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function describeOfflineBundle(urls: string[], inventory: OfflineInventory) {
  if (!urls.length) return null;
  let bytes = 0;
  const versions: string[] = [];
  for (const url of [...new Set(urls)].sort()) {
    const asset = inventory.assets[url.split('?')[0]];
    if (!asset) return null;
    bytes += asset.bytes;
    versions.push(`${url}:${asset.sha256}`);
  }
  return { bytes, version: await sha256(new TextEncoder().encode(versions.join('\n')).buffer) };
}

export async function loadOfflineInventory() {
  const response = await fetch('/offline-inventory.json', { cache: 'reload' });
  if (!response.ok) throw new Error('Download information unavailable');
  const inventory = parseOfflineInventory(await response.clone().json());
  // The inventory is sizeable; keep it with offline files, outside personal-data storage.
  try {
    const cache = await openInventoryCache();
    await cache.put('/offline-inventory.json', response);
  } catch {
    // Online size/version information remains useful when offline storage is unavailable.
  }
  return inventory;
}
function openInventoryCache() {
  return caches.open(DOWNLOAD_CACHE_NAME);
}

export async function readSavedOfflineInventory(): Promise<OfflineInventory | null> {
  try {
    const response = await (await openInventoryCache()).match('/offline-inventory.json');
    return response ? parseOfflineInventory(await response.json()) : null;
  } catch {
    return null;
  }
}
export function readBundleReceipt(id: string): BundleReceipt | null {
  const stored = readLocalStorageJson<Record<string, unknown>>(HISTORY_KEY);
  const entry = stored?.[id];
  if (!entry || typeof entry !== 'object' || !('version' in entry) || typeof entry.version !== 'string' || !HASH.test(entry.version) ||
      !('refreshedAt' in entry) || !Number.isSafeInteger(entry.refreshedAt) || Number(entry.refreshedAt) <= 0) return null;
  return entry as BundleReceipt;
}
export function saveBundleReceipt(id: string, receipt: BundleReceipt | null) {
  const history = Object.fromEntries(['core', 'maps', 'audio-ot', 'audio-nt'].map((key) => [key, readBundleReceipt(key)]));
  history[id] = receipt;
  writeLocalStorageJson(HISTORY_KEY, history);
}

export function bundleFreshness(version: string | undefined, receipt: BundleReceipt | null, complete: boolean, onlineChecked: boolean) {
  if (!version || !receipt) return 'Freshness unknown';
  if (receipt.version !== version) return 'Update available';
  if (!complete) return 'Download incomplete';
  return onlineChecked ? 'Up to date' : 'Matches last known version';
}
