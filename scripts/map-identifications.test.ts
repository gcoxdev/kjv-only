import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMapIdentifications } from "./lib/map-identifications.ts";
import { mapConfidenceLabel, mapConfidenceSummary, mapIdentificationTarget, type AncientMapPayload, type MapGeoJsonPayload } from "../src/lib/maps.ts";

const maps: AncientMapPayload = JSON.parse(readFileSync("public/maps/data/map.json", "utf8"));
const geometry = (file: string): MapGeoJsonPayload => JSON.parse(readFileSync(`public/maps/geometry/${file}`, "utf8"));

describe("proposed map locations", () => {
  it("keeps Dan's point and outline as one identification, but retains Emmaus and Sinai alternatives", () => {
    const dan = maps.find(entry => entry.geojson_file === "a513646.geojson")!;
    expect(dan.identifications).toHaveLength(1);
    expect(mapConfidenceSummary(dan)).toBe("Tel Dan · Confidence: Very high");
    const emmaus = maps.find(entry => entry.geojson_file === "ae7274b.geojson")!;
    expect(emmaus.identifications?.map(candidate => candidate.label)).toEqual([
      "Qalunya", "Emmaus Nicopolis", "El Qubeibeh", "Artas", "Khirbet Khamasa", "Abu Ghosh",
    ]);
    expect(maps.find(entry => entry.geojson_file === "abfba2a.geojson")?.identifications).toHaveLength(14);
    expect(emmaus).not.toHaveProperty("source_url");
    expect(emmaus.identifications?.map(candidate => candidate.confidence)).toEqual([338, 240, 60, 0, 0, 0]);
    expect(mapConfidenceSummary(emmaus)).toBe("6 proposed sites · Select one for confidence");
    expect(mapConfidenceSummary(emmaus, "identification-2")).toBe("Emmaus Nicopolis · Confidence: ≈24%");
    expect(mapConfidenceSummary(dan, undefined, true)).toBe("Search result · Confidence not rated");
    expect(mapConfidenceSummary({ ...dan, identifications: undefined })).toBe("Confidence unavailable");
    expect(mapIdentificationTarget(emmaus.identifications![1], geometry(emmaus.geojson_file))).toEqual({
      label: "Emmaus Nicopolis", center: [34.989458, 31.8393],
      bounds: [34.989458, 31.8393, 34.989458, 31.8393], showMarker: true,
    });
  });

  // Reads and validates geometry for all 1,278 mapped entries. Allow for
  // coverage instrumentation and disk I/O on slower runners.
  it("resolves every shipped alternative to geometry in its own entry", () => {
    for (const entry of maps.filter(entry => entry.identifications)) {
      const payload = geometry(entry.geojson_file);
      const ids = new Set(payload.features?.map(feature => feature.properties?.id));
      expect(entry.identifications!.length).toBeGreaterThan(0);
      expect(new Set(entry.identifications!.map(candidate => candidate.id)).size).toBe(entry.identifications!.length);
      expect(entry).not.toHaveProperty("source_url");
      for (const candidate of entry.identifications!) {
        expect(candidate.confidence).toBeGreaterThanOrEqual(0);
        expect(candidate.confidence).toBeLessThanOrEqual(1000);
        expect(candidate.label).not.toMatch(/<[^>]*>/);
        expect(candidate.geometry_ids.every(id => ids.has(id)), `${entry.geojson_file}: ${candidate.label}`).toBe(true);
        expect(mapIdentificationTarget(candidate, payload), `${entry.geojson_file}: ${candidate.label}`).not.toBeNull();
      }
    }
  }, 180_000);

  const mixed: MapGeoJsonPayload = { bbox: [-170, -80, 170, 80], features: [
    { properties: { id: "site.point" }, geometry: { type: "Point", coordinates: [35, 32] } },
    { properties: { id: "area.geometry" }, geometry: { type: "Polygon", coordinates: [[[30, 20], [31, 20], [31, 21], [30, 20]]] } },
    { properties: { id: "area.simplified" }, geometry: { type: "Polygon", coordinates: [[[29, 19], [32, 19], [32, 22], [29, 19]]] } },
  ] };

  it("focuses a point even when another candidate has an area, without using the full-entry bbox", () => {
    expect(mapIdentificationTarget({ id: "point", label: "Site", geometry_ids: ["site.point"] }, mixed)?.bounds)
      .toEqual([35, 32, 35, 32]);
    const area = mapIdentificationTarget({ id: "area", label: "Region", geometry_ids: ["area.geometry", "area.simplified"] }, mixed);
    expect(area?.bounds).toEqual([30, 20, 31, 21]);
    expect(area?.showMarker).toBe(false);
    expect(mapIdentificationTarget({ id: "missing", label: "Unknown", geometry_ids: ["missing"] }, mixed)).toBeNull();
  });

  it("groups roles and resolutions, removes markup, and excludes non-geographic readings", () => {
    const source = { id: "a123456", url_slug: "example", identifications: [
      { description: "<modern>Site</modern>", resolutions: [{ geojson_roles: { point: { id: "site.point" } } }] },
      { description: "Area", resolutions: [
        { geojson_roles: { geometry: { id: "area.geometry" }, simplified: { id: "area.simplified" } } },
        { geojson_roles: { geometry: { id: "area.geometry" }, other: { id: "missing" } } },
      ] },
      { description: "not a place (person)", resolutions: [] },
    ] };
    const result = buildMapIdentifications(source, mixed);
    expect(result.identifications?.map(candidate => candidate.label)).toEqual(["Site", "Area"]);
    expect(result.identifications?.[1].geometry_ids).toEqual(["area.geometry", "area.simplified"]);
    expect(buildMapIdentifications({ ...source, identifications: [source.identifications[0], source.identifications[2]] }, mixed).identifications).toHaveLength(1);
  });

  it("uses the confidence scale and indirect-path adjustment, not vote totals or a renormalized share", () => {
    const result = buildMapIdentifications({ id: "a123456", identifications: [
      { description: "Indirect", score: { time_total: 500 }, resolutions: [
        { best_time_score: 100, geojson_roles: { point: { id: "site.point" } } },
        { best_time_score: 900, geojson_roles: { point: { id: "missing" } } },
      ] },
      { description: "No score", resolutions: [{ geojson_roles: { point: { id: "site.point" } } }] },
      { description: "Negative", score: { time_total: -20 }, resolutions: [{ geojson_roles: { point: { id: "site.point" } } }] },
      { description: "Over range", score: { time_total: 1169 }, resolutions: [{ geojson_roles: { point: { id: "site.point" } } }] },
      { description: "Invalid path", score: { time_total: 900 }, resolutions: [{ best_time_score: NaN, geojson_roles: { point: { id: "site.point" } } }] },
    ] }, mixed);
    expect(result.identifications?.map(candidate => candidate.confidence)).toEqual([50, undefined, 0, 1000, undefined]);
    expect([undefined, NaN, 0, 99, 100, 338, 999, 1000].map(mapConfidenceLabel))
      .toEqual(["Not rated", "Not rated", "<10%", "<10%", "≈10%", "≈34%", "≈99%", "Very high"]);
  });
});
