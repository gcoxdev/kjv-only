#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const DIST_DIR = path.resolve("dist");
const REQUIRED_PATHS = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "theme-init.js",
  "app-cache-config.js",
  "app-shell-assets.json",
  "offline-inventory.json",
  "data/kjv-bootstrap.json",
  "data/kjv.json",
  "data/kjv-manifest.json",
  "icons/app-icon.svg",
  "icons/app-icon.png",
  "icons/app-logo.png",
  "icons/app-icon-512.png",
  "icons/app-icon-maskable.png",
  "icons/pwa-icon-192-transparent.png",
  "icons/pwa-icon-512-transparent.png",
  "icons/pwa-icon-192-maskable-v2.png",
  "icons/pwa-icon-512-maskable-v2.png",
  "icons/apple-touch-icon.png",
  "icons/favicon.png",
  "topics/daily-scripture-topics.json",
  "topics/topics-index.json",
];
const FORBIDDEN_PATHS = [
  "delete",
  "data/kjv.sqlite",
  "data/kjv.osis.xml",
];
const FORBIDDEN_FILE_PATTERNS = [
  { pattern: /\.kml$/i, label: "KML generator input" },
  { pattern: /\.jsonl$/i, label: "JSONL generator input" },
  { pattern: /\.zip$/i, label: "source archive" },
  { pattern: /^maps\/schemas\//, label: "map schema" },
  { pattern: /^maps\/thumbnails\//, label: "unused map thumbnail" },
  { pattern: /^maps\/data\/(?!map\.json$)/, label: "non-runtime map data" },
  { pattern: /^references\/ancient_map\.json$/, label: "legacy map source" },
];
const BUDGETS = {
  maxFiles: 7_000,
  maxTotalBytes: 1_150_000_000,
  maxEntryJavaScriptBytes: 600_000,
  maxEntryCssBytes: 180_000,
};

async function sha256(filePath) {
  const contents = await fs.readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(DIST_DIR, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const value = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(value)));
    } else if (entry.isFile()) {
      const stats = await fs.stat(value);
      files.push({ path: value, size: stats.size });
    }
  }
  return files;
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isCorpusAsset(asset, expected) {
  return (
    asset &&
    typeof asset === "object" &&
    !Array.isArray(asset) &&
    asset.url === expected.url &&
    /^[a-f0-9]{64}$/.test(asset.sha256) &&
    isPositiveSafeInteger(asset.bytes) &&
    asset.bookCount === expected.bookCount &&
    asset.chapterCount === expected.chapterCount &&
    asset.verseCount === expected.verseCount
  );
}

const failures = [];
for (const requiredPath of REQUIRED_PATHS) {
  if (!(await exists(requiredPath))) {
    failures.push(`Missing required runtime asset: ${requiredPath}`);
  }
}
for (const forbiddenPath of FORBIDDEN_PATHS) {
  if (await exists(forbiddenPath)) {
    failures.push(`Forbidden build artifact: ${forbiddenPath}`);
  }
}

try {
  const serviceWorkerSource = await fs.readFile(
    path.join(DIST_DIR, "sw.js"),
    "utf8",
  );
  const cacheConfig = await fs.readFile(path.join(DIST_DIR, "app-cache-config.js"), "utf8");
  const buildCache = cacheConfig.match(/"cacheName":"(kjv-only-cache-build-[a-f0-9]{20})"/)?.[1];
  if (!buildCache || !serviceWorkerSource.includes(`const BUILD_CACHE_NAME = "${buildCache}"`)) {
    failures.push("The generated worker and app must use the same build-specific cache");
  }
  const installStart = serviceWorkerSource.indexOf(
    'self.addEventListener("install"',
  );
  const activateStart = serviceWorkerSource.indexOf(
    'self.addEventListener("activate"',
  );
  const messageStart = serviceWorkerSource.indexOf(
    'self.addEventListener("message"',
  );
  const installHandler = serviceWorkerSource.slice(installStart, messageStart);
  const messageHandler = serviceWorkerSource.slice(messageStart, activateStart);
  if (
    installStart < 0 ||
    messageStart <= installStart ||
    activateStart <= installStart ||
    !installHandler.includes("event.waitUntil(cacheAppShell())") ||
    installHandler.includes("skipWaiting") ||
    !messageHandler.includes("KJV_ONLY_SKIP_WAITING") ||
    !messageHandler.includes(".then(() => self.skipWaiting())") ||
    !serviceWorkerSource.includes("KJV_ONLY_UPDATE_ACTIVATING") ||
    !serviceWorkerSource.includes("MessageChannel") ||
    !messageHandler.includes("includeUncontrolled: true")
  ) {
    failures.push("Invalid controlled service-worker update lifecycle");
  }
} catch (error) {
  failures.push(
    `Could not validate the service-worker update lifecycle: ${error instanceof Error ? error.message : String(error)}`,
  );
}

const files = await collectFiles(DIST_DIR);
for (const file of files) {
  const relative = path.relative(DIST_DIR, file.path).split(path.sep).join("/");
  const forbidden = FORBIDDEN_FILE_PATTERNS.find(({ pattern }) =>
    pattern.test(relative),
  );
  if (forbidden) {
    failures.push(`Forbidden ${forbidden.label}: ${relative}`);
  }
}
const totalBytes = files.reduce((total, file) => total + file.size, 0);
const entryJavaScript = files.find((file) =>
  /\/assets\/index-[^/]+\.js$/.test(file.path),
);
const entryCss = files.find((file) =>
  /\/assets\/index-[^/]+\.css$/.test(file.path),
);

try {
  const manifest = JSON.parse(
    await fs.readFile(path.join(DIST_DIR, "app-shell-assets.json"), "utf8"),
  );
  const assetUrls = files
    .map((file) => `/${path.relative(DIST_DIR, file.path).split(path.sep).join("/")}`)
    .filter((url) => url.startsWith("/assets/"))
    .sort();
  const offlineIconUrls = files
    .map((file) => `/${path.relative(DIST_DIR, file.path).split(path.sep).join("/")}`)
    .filter((url) => /^\/icons\/(?:bw|color)\/[^/]+\.png$/.test(url))
    .sort();
  const assetUrlPattern =
    /^\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.assets) ||
    !Array.isArray(manifest.startupAssets) ||
    !Array.isArray(manifest.offlineIconAssets) ||
    new Set(manifest.assets).size !== manifest.assets.length ||
    new Set(manifest.startupAssets).size !== manifest.startupAssets.length ||
    new Set(manifest.offlineIconAssets).size !==
      manifest.offlineIconAssets.length ||
    !manifest.assets.every(
      (url) => typeof url === "string" && assetUrlPattern.test(url),
    ) ||
    !manifest.startupAssets.every(
      (url) => typeof url === "string" && assetUrlPattern.test(url),
    ) ||
    !manifest.offlineIconAssets.every(
      (url) =>
        typeof url === "string" &&
        /^\/icons\/(?:bw|color)\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.png$/.test(url),
    ) ||
    JSON.stringify(manifest.assets) !== JSON.stringify(assetUrls) ||
    JSON.stringify(manifest.offlineIconAssets) !==
      JSON.stringify(offlineIconUrls) ||
    manifest.startupAssets.length === 0 ||
    !manifest.startupAssets.every((url) => assetUrls.includes(url))
  ) {
    failures.push("Invalid or incomplete app-shell asset manifest");
  }
} catch (error) {
  failures.push(
    `Could not validate app-shell asset manifest: ${error instanceof Error ? error.message : String(error)}`,
  );
}

try {
  const manifest = JSON.parse(
    await fs.readFile(path.join(DIST_DIR, "data/kjv-manifest.json"), "utf8"),
  );
  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.schemaVersion !== 1 ||
    !/^sha256-[a-f0-9]{16}$/.test(manifest.corpusVersion)
  ) {
    throw new Error("Invalid corpus manifest schema");
  }
  const expectedAssets = [
    [manifest.bootstrap, {
      url: "/data/kjv-bootstrap.json",
      bookCount: 1,
      chapterCount: 1,
      verseCount: 31,
    }],
    [manifest.full, {
      url: "/data/kjv.json",
      bookCount: 66,
      chapterCount: 1189,
      verseCount: 31102,
    }],
  ];
  for (const [asset, expected] of expectedAssets) {
    if (!isCorpusAsset(asset, expected)) {
      failures.push(`Invalid corpus manifest asset: ${expected.url}`);
      continue;
    }
    const assetPath = path.join(DIST_DIR, expected.url.replace(/^\//, ""));
    const stats = await fs.stat(assetPath);
    if (stats.size !== asset.bytes) {
      failures.push(
        `Corpus manifest byte mismatch: ${expected.url} (${stats.size} !== ${asset.bytes})`,
      );
    }
    if ((await sha256(assetPath)) !== asset.sha256) {
      failures.push(`Corpus manifest hash mismatch: ${expected.url}`);
    }
  }
  const fullHash = await sha256(path.join(DIST_DIR, "data/kjv.json"));
  if (manifest.corpusVersion !== `sha256-${fullHash.slice(0, 16)}`) {
    failures.push("Corpus manifest version does not match the full corpus hash");
  }
} catch (error) {
  failures.push(
    `Could not validate corpus manifest: ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (files.length > BUDGETS.maxFiles) {
  failures.push(`File budget exceeded: ${files.length} > ${BUDGETS.maxFiles}`);
}
if (totalBytes > BUDGETS.maxTotalBytes) {
  failures.push(`Byte budget exceeded: ${totalBytes} > ${BUDGETS.maxTotalBytes}`);
}
if (!entryJavaScript || entryJavaScript.size > BUDGETS.maxEntryJavaScriptBytes) {
  failures.push(
    `Entry JavaScript budget exceeded or missing: ${entryJavaScript?.size ?? "missing"} > ${BUDGETS.maxEntryJavaScriptBytes}`,
  );
}
if (!entryCss || entryCss.size > BUDGETS.maxEntryCssBytes) {
  failures.push(
    `Entry CSS budget exceeded or missing: ${entryCss?.size ?? "missing"} > ${BUDGETS.maxEntryCssBytes}`,
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      files: files.length,
      totalBytes,
      entryJavaScriptBytes: entryJavaScript.size,
      entryCssBytes: entryCss.size,
    },
    null,
    2,
  ),
);
