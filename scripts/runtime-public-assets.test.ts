import { describe, expect, it } from "vitest"

import {
  isAllowedRuntimeFile,
  runtimeAssetRequestPath,
} from "../vite.config"

describe("runtime public asset policy", () => {
  it.each([
    "data/kjv.json",
    "data/kjv-compact-v1.json",
    "data/kjv-bootstrap.json",
    "data/kjv-manifest.json",
    "audio/GEN.1.mp3",
    "icons/color/Genesis.png",
    "maps/geometry/ancient-world.geojson",
  ])("allows an intended runtime asset: %s", (relative) => {
    expect(isAllowedRuntimeFile(relative)).toBe(true)
  })

  it.each([
    "data/kjv.sqlite",
    "data/kjv.osis.xml",
    "../public/data/kjv.json",
    "maps/schemas/map.schema.json",
    "maps/thumbnails/ancient-world.webp",
    "maps/thumbnails/ancient-world.jpg",
    "maps/thumbnails/ancient-world.png",
    "audio/GEN.0.mp3",
    "icons/color/bad name.png",
  ])("rejects a non-runtime asset: %s", (relative) => {
    expect(isAllowedRuntimeFile(relative)).toBe(false)
  })

  it("allows query strings without broadening the path", () => {
    expect(runtimeAssetRequestPath("/data/kjv.json?v=1")).toBe("data/kjv.json")
  })

  it.each([
    "/data/../data/kjv.json",
    "/data/%2e%2e/data/kjv.json",
    "/data%2fkjv.json",
    "/data%5ckjv.json",
    "/data\\kjv.json",
    "//data/kjv.json",
    "data/kjv.json",
    "/data/%252e%252e/kjv.json",
    "/data/kjv.json%00",
    "/data/kjv.json/extra",
    "/data/%E0%A4%A",
  ])("rejects an ambiguous runtime request path: %s", (requestUrl) => {
    expect(runtimeAssetRequestPath(requestUrl)).toBeNull()
  })
})
