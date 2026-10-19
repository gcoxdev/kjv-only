import { describe, expect, it } from "vitest";

import {
  boundsForGeoJson,
  cleanMapMarkup,
  mapGeoJsonForDisplay,
  mapEntrySearchableText,
  matchesMapWord,
  parseJsonl,
} from "@/lib/maps";
import {
  containsMapNameField,
  DEFAULT_MAP_RENDERER,
  ENGLISH_MAP_NAME_EXPRESSION,
  isMapRenderer,
  normalizeOpenFreeMapStyle,
  readSessionMapRenderer,
} from "@/lib/map-renderers";

describe("maps helpers", () => {
  it.each([
    ['  <modern id="x">Tel\n Dan</modern>  ', "Tel Dan"],
    ["<modern><b>Dan</b></modern>", "Dan"],
    ["<<modern>Dan</modern>>", "Dan"],
    ["<scr<script>ipt>", "ipt"],
    ["Dan <script", "Dan"],
    ["Dan <> >", "Dan"],
    ["&lt;modern&gt;Dan&lt;/modern&gt;", "&lt;modern&gt;Dan&lt;/modern&gt;"],
  ])("converts source markup to text without leftover angle brackets: %s", (input, expected) => {
    const text = cleanMapMarkup(input);
    expect(text).toBe(expected);
    expect(text).not.toMatch(/[<>]/);
    expect(cleanMapMarkup(text)).toBe(text);
  });

  it("cleans markup and matches normalized words", () => {
    expect(cleanMapMarkup('<modern id="x">Arabian Peninsula</modern>')).toBe(
      "Arabian Peninsula",
    );

    expect(
      matchesMapWord(
        {
          geojson_file: "test.geojson",
          translations: ["Havilah"],
          types: ["region"],
          verses: ["GEN.2.11"],
          modern_names: ["Arabian Peninsula"],
        },
        "havilah,",
        (value) => value.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""),
      ),
    ).toBe(true);
  });

  it("builds searchable text and parses jsonl", () => {
    expect(
      mapEntrySearchableText({
        geojson_file: "test.geojson",
        translations: ["Havilah"],
        types: ["region"],
        verses: ["GEN.2.11"],
        modern_names: ["Arabian Peninsula"],
      }),
    ).toContain("arabian peninsula");

    expect(parseJsonl<{ id: number }>('{"id":1}\n{"id":2}\n')).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("derives bounds from bbox or coordinates", () => {
    expect(
      boundsForGeoJson({ bbox: [1, 2, 3, 4] }),
    ).toEqual([
      [2, 1],
      [4, 3],
    ]);

    expect(
      boundsForGeoJson({
        features: [
          {
            geometry: {
              coordinates: [
                [10, 20],
                [30, 40],
              ],
            },
          },
        ],
      }),
    ).toEqual([
      [20, 10],
      [40, 30],
    ]);
  });

  it("uses detailed geometry once and keeps points for point-only maps", () => {
    const preciseFeature = {
      geometry: { type: "LineString", coordinates: [[1, 2], [3, 4]] },
      properties: { id: "river.geometry" },
    };
    expect(
      mapGeoJsonForDisplay({
        bbox: [0, 0, 100, 100],
        features: [
          preciseFeature,
          {
            geometry: { type: "LineString", coordinates: [[1, 2]] },
            properties: { id: "river.simplified" },
          },
          {
            geometry: { type: "Point", coordinates: [1, 2] },
            properties: { id: "river.point" },
          },
        ],
      }),
    ).toEqual({ bbox: undefined, features: [preciseFeature] });

    const pointOnlyPayload = {
      features: [
        {
          geometry: { type: "Point", coordinates: [1, 2] },
          properties: { id: "place.point" },
        },
      ],
    };
    expect(mapGeoJsonForDisplay(pointOnlyPayload)).toBe(pointOnlyPayload);
  });

  it("defaults to OpenFreeMap and recognizes supported renderers", () => {
    expect(DEFAULT_MAP_RENDERER).toBe("open-free-map");
    expect(isMapRenderer("open-free-map")).toBe(true);
    expect(isMapRenderer("leaflet")).toBe(true);
    expect(isMapRenderer("unknown")).toBe(false);
    expect(readSessionMapRenderer()).toBe("open-free-map");
  });

  it("identifies name label expressions without changing road shields", () => {
    expect(
      containsMapNameField([
        "case",
        ["has", "name:nonlatin"],
        ["get", "name:latin"],
        ["get", "name_en"],
      ]),
    ).toBe(true);
    expect(containsMapNameField(["to-string", ["get", "ref"]])).toBe(false);
    expect(ENGLISH_MAP_NAME_EXPRESSION).toEqual([
      "coalesce",
      ["get", "name_en"],
      ["get", "name:en"],
      ["get", "name:latin"],
      ["get", "name"],
    ]);
  });

  it("makes OpenFreeMap ordered numeric filters null-safe", () => {
    const style = normalizeOpenFreeMapStyle({
      version: 8,
      sources: {},
      layers: [
        {
          id: "road_shield_us",
          type: "symbol",
          source: "roads",
          "source-layer": "transportation_name",
          filter: ["<=", ["get", "ref_length"], 6],
        },
        {
          id: "unchanged",
          type: "symbol",
          source: "roads",
          "source-layer": "transportation_name",
          filter: ["==", ["get", "class"], "motorway"],
        },
      ],
    });

    const roadShieldLayer = style.layers[0];
    const unchangedLayer = style.layers[1];
    expect(
      roadShieldLayer && "filter" in roadShieldLayer
        ? roadShieldLayer.filter
        : undefined,
    ).toEqual([
      "<=",
      ["coalesce", ["get", "ref_length"], 9999],
      6,
    ]);
    expect(
      unchangedLayer && "filter" in unchangedLayer
        ? unchangedLayer.filter
        : undefined,
    ).toEqual([
      "==",
      ["get", "class"],
      "motorway",
    ]);
  });
});
