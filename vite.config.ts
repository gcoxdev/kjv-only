import { createHash } from "node:crypto"
import { buildOfflineInventory, writeOfflineInventory } from "./scripts/lib/offline-inventory.ts"
import path from "path"
import { constants } from "node:fs"
import fs from "node:fs/promises"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import sirv from "sirv"
import { defineConfig, type Connect, type Plugin } from "vite"

const RUNTIME_PUBLIC_ENTRIES = [
  "_headers",
  "theme-init.js",
  "app-cache-config.js",
  "audio",
  "data",
  "icons",
  "manifest.webmanifest",
  "maps",
  "other",
  "references",
  "sw.js",
  "topics",
] as const

const EXACT_RUNTIME_ASSETS = new Set([
  "_headers",
  "theme-init.js",
  "app-cache-config.js",
  "data/kjv-bootstrap.json",
  "data/kjv.json",
  "data/kjv-compact-v1.json",
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
  "manifest.webmanifest",
  "maps/data/map.json",
  "other/paypal-donate-qr.svg",
  "references/ai-dictionary.json",
  "references/bible-word-book.json",
  "references/concordance.compact.delta.min.json",
  "references/cross-refs.json",
  "references/genealogy.compact.min.json",
  "references/hitchcocks.json",
  "references/old-english.json",
  "references/phrases.json",
  "references/strongs-greek.compact.min.json",
  "references/strongs-hebrew.compact.min.json",
  "references/units.json",
  "references/websters.json",
  "sw.js",
  "topics/daily-scripture-topics.json",
  "topics/topics-index.json",
])

const OFFLINE_ICON_ASSET_URL_PATTERN =
  /^\/icons\/(?:bw|color)\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.png$/

export function isAllowedRuntimeFile(relative: string) {
  return (
    EXACT_RUNTIME_ASSETS.has(relative) ||
    /^audio\/[A-Z0-9]{2,4}\.[1-9]\d{0,2}\.mp3$/.test(relative) ||
    /^icons\/(?:bw|color)\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.png$/.test(
      relative,
    ) ||
    /^maps\/geometry\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.geojson$/.test(
      relative,
    )
  )
}

export function runtimeAssetRequestPath(requestUrl: string | undefined) {
  if (!requestUrl) return null

  try {
    const rawPathname = requestUrl.split(/[?#]/, 1)[0]
    if (
      !rawPathname.startsWith("/") ||
      rawPathname.startsWith("//") ||
      rawPathname.includes("\\") ||
      /%(?:2f|5c)/i.test(rawPathname)
    ) {
      return null
    }
    const pathname = decodeURIComponent(rawPathname)
    if (pathname.split("/").some((segment) => segment === "." || segment === "..")) {
      return null
    }
    const relative = pathname.slice(1)
    return isAllowedRuntimeFile(relative) ? relative : null
  } catch {
    return null
  }
}

function runtimePublicAssets(): Plugin {
  let outputDirectory = path.resolve(import.meta.dirname, "dist")
  const publicDirectory = path.resolve(import.meta.dirname, "public")
  const serveRuntimeAssets = sirv(publicDirectory, {
    dev: true,
    etag: true,
    single: false,
  })

  function isRuntimeAssetRequest(requestUrl: string | undefined) {
    return runtimeAssetRequestPath(requestUrl) !== null
  }

  function installRuntimeAssetMiddleware(middlewares: Connect.Server) {
    middlewares.use((request, response, next) => {
      if (!isRuntimeAssetRequest(request.url)) {
        next()
        return
      }
      serveRuntimeAssets(request, response, next)
    })
  }

  function installDevelopmentManifestMiddleware(middlewares: Connect.Server) {
    const offlineIconAssetsPromise = collectGeneratedAssetUrls(
      path.join(publicDirectory, "icons"),
      publicDirectory,
    ).then((urls) =>
      urls.filter((url) => OFFLINE_ICON_ASSET_URL_PATTERN.test(url)).sort(),
    )

    let inventoryPromise: ReturnType<typeof buildOfflineInventory> | undefined
    middlewares.use((request, response, next) => {
      if (request.url?.split(/[?#]/, 1)[0] === "/offline-inventory.json") {
        inventoryPromise ??= collectGeneratedAssetUrls(publicDirectory, publicDirectory)
          .then((urls) => buildOfflineInventory(publicDirectory, urls.filter((url) => isAllowedRuntimeFile(url.slice(1)))))
        void inventoryPromise.then((inventory) => {
          response.setHeader("content-type", "application/json")
          response.end(JSON.stringify(inventory))
        }).catch((error) => { inventoryPromise = undefined; next(error) })
        return
      }
      if (request.url?.split(/[?#]/, 1)[0] !== "/app-shell-assets.json") {
        next()
        return
      }
      void offlineIconAssetsPromise
        .then((offlineIconAssets) => {
          response.statusCode = 200
          response.setHeader("content-type", "application/json; charset=utf-8")
          response.end(
            `${JSON.stringify({
              schemaVersion: 1,
              startupAssets: [],
              assets: [],
              offlineIconAssets,
            })}\n`,
          )
        })
        .catch(next)
    })
  }

  async function collectCopyTasks(
    source: string,
    destination: string,
    tasks: Array<{ source: string; destination: string }>,
  ) {
    const relative = path
      .relative(publicDirectory, source)
      .split(path.sep)
      .join("/")
    const stats = await fs.lstat(source)
    if (stats.isSymbolicLink()) {
      throw new Error(`Runtime public assets may not contain symlinks: ${relative}`)
    }
    if (stats.isDirectory()) {
      const entries = await fs.readdir(source)
      await Promise.all(
        entries.map((entry) =>
          collectCopyTasks(
            path.join(source, entry),
            path.join(destination, entry),
            tasks,
          ),
        ),
      )
      return
    }
    if (stats.isFile() && isAllowedRuntimeFile(relative)) {
      tasks.push({ source, destination })
    }
  }

  async function copyRuntimeEntries() {
    const tasks: Array<{ source: string; destination: string }> = []
    await Promise.all(
      RUNTIME_PUBLIC_ENTRIES.map((entry) =>
        collectCopyTasks(
          path.join(publicDirectory, entry),
          path.join(outputDirectory, entry),
          tasks,
        ),
      ),
    )

    const pending = [...tasks]
    const concurrency = Math.min(32, pending.length)
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        for (;;) {
          const task = pending.pop()
          if (!task) return
          await fs.mkdir(path.dirname(task.destination), { recursive: true })
          await fs.copyFile(
            task.source,
            task.destination,
            constants.COPYFILE_FICLONE,
          )
        }
      }),
    )
  }

  async function collectGeneratedAssetUrls(
    directory: string,
    rootDirectory = outputDirectory,
  ): Promise<string[]> {
    const urls: string[] = []
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        urls.push(...(await collectGeneratedAssetUrls(absolute, rootDirectory)))
      } else if (entry.isFile()) {
        urls.push(
          `/${path.relative(rootDirectory, absolute).split(path.sep).join("/")}`,
        )
      }
    }
    return urls
  }

  async function writeAppShellAssetManifest() {
    const assets = (await collectGeneratedAssetUrls(path.join(outputDirectory, "assets")))
      .sort()
    const offlineIconAssets = (
      await collectGeneratedAssetUrls(path.join(outputDirectory, "icons"))
    )
      .filter((url) => OFFLINE_ICON_ASSET_URL_PATTERN.test(url))
      .sort()
    const indexHtml = await fs.readFile(path.join(outputDirectory, "index.html"), "utf8")
    const assetSet = new Set(assets)
    const startupAssets = Array.from(
      new Set(
        Array.from(
          indexHtml.matchAll(/\b(?:href|src)=["'](\/assets\/[^"']+)["']/g),
          (match) => match[1],
        ).filter((url) => assetSet.has(url)),
      ),
    ).sort()
    const manifestPath = path.join(outputDirectory, "app-shell-assets.json")
    const temporaryPath = `${manifestPath}.tmp`
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify({
        schemaVersion: 1,
        startupAssets,
        assets,
        offlineIconAssets,
      })}\n`,
      "utf8",
    )
    await fs.rename(temporaryPath, manifestPath)
    const hash = createHash("sha256").update(await fs.readFile(manifestPath)).update(indexHtml)
    // Fixed-name shell resources must also invalidate an installed worker.
    for (const file of ["sw.js", "theme-init.js", "manifest.webmanifest", "app-cache-config.js", ...(await collectGeneratedAssetUrls(path.join(outputDirectory, "icons"))).map(url => url.slice(1))]) {
      hash.update(await fs.readFile(path.join(outputDirectory, file)))
    }
    const cacheName = `kjv-only-cache-build-${hash.digest("hex").slice(0, 20)}`
    await fs.writeFile(path.join(outputDirectory, "app-cache-config.js"), `globalThis.KJV_ONLY_CACHE_CONFIG = Object.freeze(${JSON.stringify({ cachePrefix: "kjv-only-cache-", cacheName })});\n`)
    const workerPath = path.join(outputDirectory, "sw.js")
    const worker = await fs.readFile(workerPath, "utf8")
    await fs.writeFile(workerPath, worker.replace("const BUILD_CACHE_NAME = null", `const BUILD_CACHE_NAME = ${JSON.stringify(cacheName)}`))

  }

  return {
    name: "runtime-public-assets",
    configureServer(server) {
      installDevelopmentManifestMiddleware(server.middlewares)
      installRuntimeAssetMiddleware(server.middlewares)
    },
    // Preview must serve the generated cache config and worker from dist.
    configResolved(config) {
      outputDirectory = path.resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await copyRuntimeEntries()
      await writeAppShellAssetManifest()
      await writeOfflineInventory(outputDirectory, (await collectGeneratedAssetUrls(outputDirectory)).filter((url) => url !== "/_headers" && url !== "/offline-inventory.json"))
    },
  }
}

export default defineConfig({
  publicDir: false,
  plugins: [react(), tailwindcss(), runtimePublicAssets()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          const id = moduleId.split(path.sep).join("/")
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor"
          }
          if (
            id.includes("/node_modules/@base-ui/") ||
            id.includes("/node_modules/lucide-react/") ||
            id.includes("/node_modules/cmdk/") ||
            id.includes("/node_modules/sonner/")
          ) {
            return "ui-vendor"
          }
          if (id.endsWith("/src/lib/keyboard-shortcut-runtime.ts")) {
            return "keyboard-shortcuts"
          }
          if (id.includes("/node_modules/@lexical/") || id.includes("/node_modules/lexical/")) {
            return "editor-vendor"
          }
          if (
            id.includes("/node_modules/leaflet/") ||
            id.includes("/node_modules/react-leaflet/")
          ) {
            return "leaflet-vendor"
          }
          if (id.includes("/node_modules/maplibre-gl/")) {
            return "maplibre-vendor"
          }
          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
