import type { MapAreaBounds } from "./map-area.ts";

export type MapIdentification = {
  id: string;
  label: string;
  geometry_ids: string[];
  /** Adjusted source confidence on OpenBible's 0–1000 scale; not vote totals. */
  confidence?: number;
};

export type AncientMapEntry = {
  /** Transient study-selection annotation; never stored in the map corpus. */
  selectionNote?: string;
  bounds?: MapAreaBounds[];
  verses: string[];
  translations: string[];
  types: string[];
  geojson_file: string;
  modern_names: string[];
  /** Proposed identifications, grouping each site's shapes; includes sole sites. */
  identifications?: MapIdentification[];
};

export type AncientMapPayload = AncientMapEntry[];

export type MapGeoJsonPayload = {
  type?: string;
  bbox?: number[];
  features?: Array<{
    type?: string;
    properties?: Record<string, unknown>;
    geometry?: {
      type?: string;
      coordinates?: unknown;
    };
  }>;
};

export type MapImageThumbnail = {
  file?: string;
  description?: string;
};

export type MapImageEntry = {
  id: string;
  credit?: string;
  credit_url?: string;
  url?: string;
  file_url?: string;
  thumbnail_url_pattern?: string;
  license?: string;
  descriptions?: Record<string, string>;
  thumbnails?: Record<string, MapImageThumbnail>;
};

export function mapEntryLabel(entry: AncientMapEntry) {
  return entry.translations[0] ?? entry.geojson_file.replace(".geojson", "");
}

export function matchesMapWord(
  entry: AncientMapEntry,
  rawWord: string,
  normalizeWord: (value: string) => string,
) {
  const cleaned = normalizeWord(rawWord).toLowerCase();
  if (!cleaned) {
    return false;
  }

  return entry.translations.some(
    (name) => normalizeWord(name).toLowerCase() === cleaned,
  );
}

export function mapEntrySearchableText(entry: AncientMapEntry) {
  return [
    ...entry.translations,
    ...entry.modern_names,
    ...entry.types,
    ...entry.verses,
    entry.geojson_file,
  ]
    .join(" ")
    .toLowerCase();
}

/** Plain-text labels from source markup; callers must render as text, never HTML. */
export function cleanMapMarkup(input: string) {
  let text = "";
  let insideTag = false;
  // Source labels use simple wrappers such as <modern id="...">. Discard
  // tag contents (including an unfinished tag) and never copy angle brackets.
  for (const character of input) {
    if (character === "<") insideTag = true;
    else if (character === ">") insideTag = false;
    else if (!insideTag) text += character;
  }
  return text.replace(/\s+/g, " ").trim();
}

export function mapConfidenceLabel(score?: number) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "Not rated";
  if (score >= 1000) return "Very high";
  if (score < 100) return "<10%";
  return `≈${Math.min(99, Math.round(score / 10))}%`;
}

export function mapConfidenceSummary(entry: AncientMapEntry | null, selectedId?: string, searchResult = false) {
  if (searchResult) return "Search result · Confidence not rated";
  const candidates = entry?.identifications ?? [];
  const selected = selectedId ? candidates.find(candidate => candidate.id === selectedId)
    : candidates.length === 1 ? candidates[0] : undefined;
  if (selected) return `${selected.label} · Confidence: ${mapConfidenceLabel(selected.confidence)}`;
  if (candidates.length > 1) return `${candidates.length} proposed sites · Select one for confidence`;
  return "Confidence unavailable";
}

export function mapIdentificationTarget(identification: MapIdentification, geojson: MapGeoJsonPayload) {
  const ids = new Set(identification.geometry_ids);
  // Match against raw features first: the whole-entry display cleanup may have
  // hidden a point because a different candidate has an outline.
  const candidate = mapGeoJsonForDisplay({ features: geojson.features?.filter(feature =>
    typeof feature.properties?.id === "string" && ids.has(feature.properties.id),
  ) });
  const bounds = boundsForGeoJson(candidate);
  if (!bounds) return null;
  const [[south, west], [north, east]] = bounds;
  if (![west, south, east, north].every(Number.isFinite) || west < -180 || east > 180 || south < -90 || north > 90) return null;
  return {
    label: identification.label,
    center: [(west + east) / 2, (south + north) / 2] as [number, number],
    bounds: [west, south, east, north] as MapAreaBounds,
    // A region's bounding-box center is not a verified point location.
    showMarker: west === east && south === north,
  };
}

function extractCoordinateBounds(
  coordinates: unknown,
  accumulator: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    const lng = coordinates[0];
    const lat = coordinates[1];
    accumulator.minLat = Math.min(accumulator.minLat, lat);
    accumulator.maxLat = Math.max(accumulator.maxLat, lat);
    accumulator.minLng = Math.min(accumulator.minLng, lng);
    accumulator.maxLng = Math.max(accumulator.maxLng, lng);
    return;
  }

  for (const item of coordinates) {
    extractCoordinateBounds(item, accumulator);
  }
}

export function boundsForGeoJson(payload: MapGeoJsonPayload) {
  if (Array.isArray(payload.bbox) && payload.bbox.length >= 4) {
    return [
      [payload.bbox[1], payload.bbox[0]],
      [payload.bbox[3], payload.bbox[2]],
    ] as [[number, number], [number, number]];
  }

  const bounds = {
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
    minLng: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
  };

  for (const feature of payload.features ?? []) {
    extractCoordinateBounds(feature.geometry?.coordinates, bounds);
  }

  if (
    !Number.isFinite(bounds.minLat) ||
    !Number.isFinite(bounds.maxLat) ||
    !Number.isFinite(bounds.minLng) ||
    !Number.isFinite(bounds.maxLng)
  ) {
    return null;
  }

  return [
    [bounds.minLat, bounds.minLng],
    [bounds.maxLat, bounds.maxLng],
  ] as [[number, number], [number, number]];
}

function mapFeatureId(
  feature: NonNullable<MapGeoJsonPayload["features"]>[number],
) {
  const id = feature.properties?.id;
  return typeof id === "string" ? id : null;
}

function isPointGeometry(type: string | undefined) {
  return type === "Point" || type === "MultiPoint";
}

/**
 * Removes display-only duplicates from the source map data without changing the
 * stored corpus. Detailed geometry and its simplified fallback frequently ship
 * together, while representative points accompany paths and areas for indexing.
 */
export function mapGeoJsonForDisplay(
  payload: MapGeoJsonPayload,
): MapGeoJsonPayload {
  const features = payload.features;
  if (!features?.length) {
    return payload;
  }

  const featureIds = new Set(
    features.map(mapFeatureId).filter((id): id is string => id !== null),
  );
  const withoutSimplifiedDuplicates = features.filter((feature) => {
    const id = mapFeatureId(feature);
    if (!id?.endsWith(".simplified")) {
      return true;
    }

    return !featureIds.has(`${id.slice(0, -".simplified".length)}.geometry`);
  });
  const hasNonPointGeometry = withoutSimplifiedDuplicates.some(
    (feature) =>
      Boolean(feature.geometry?.type) &&
      !isPointGeometry(feature.geometry?.type),
  );
  const displayFeatures = hasNonPointGeometry
    ? withoutSimplifiedDuplicates.filter(
        (feature) => !isPointGeometry(feature.geometry?.type),
      )
    : withoutSimplifiedDuplicates;

  if (displayFeatures.length === features.length) {
    return payload;
  }

  return { ...payload, bbox: undefined, features: displayFeatures };
}

export function parseJsonl<T>(text: string) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
