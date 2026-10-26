import { readFileSync, writeFileSync } from "node:fs";

// Offline schematic outlines derived from the existing OpenBible geography pack.
// Keep provenance: public/maps/readme.md and the app's Credits cover CC BY 4.0
// and, where applicable, OpenStreetMap's ODbL. No historical shoreline is claimed.
const sources = {
  sea: ["aa805fb", "g23ec09.geometry"],
  galilee: ["a562fcc", "gdea47d.simplified"],
  salt: ["abed304", "g2e7540.simplified"],
  jordan: ["ae686c9", "ga8da80.simplified"],
  cyprus: ["a2e7601", "g017f10.simplified"],
  patmos: ["a8f60f3", "gac481f.simplified"],
  samos: ["acf6ec0", "gf40806.simplified"],
  chios: ["a4c2c75", "gcd1146.simplified"],
};
const definitions = {
  levant: { label: "Eastern Mediterranean coast and inland cities", bounds: [34.1, 31.1, 36.7, 33.9], features: ["sea", "galilee", "salt", "jordan"] },
  "southern-coast": { label: "Philistine coastal plain", bounds: [34.25, 31.3, 34.9, 31.95], features: ["sea"] },
  cyprus: { label: "Cyprus and the southern coast of Asia Minor", bounds: [30.4, 34.25, 34.9, 37.35], features: ["sea", "cyprus"] },
  asia: { label: "Western Asia Minor", bounds: [26.6, 37.65, 27.8, 39.45], features: ["sea", "samos", "chios"] },
  islands: { label: "Eastern Aegean islands (mainland omitted)", bounds: [25.65, 37.0, 27.25, 38.8], features: ["patmos", "samos", "chios"], waterBackground: true },
};
const result = {};
for (const [id, definition] of Object.entries(definitions)) {
  const width = 400, height = 360;
  const [west, south, east, north] = definition.bounds;
  const lon = (east + west) / 2, lat = (north + south) / 2;
  const cos = Math.cos(lat * Math.PI / 180);
  // Expand the frame to preserve local proportions, never stretch the geography.
  const spanY = Math.max(north - south, (east - west) * cos * height / width);
  const spanX = spanY * width / height / cos;
  const bounds = [lon - spanX / 2, lat - spanY / 2, lon + spanX / 2, lat + spanY / 2];
  const project = ([x, y]) => [width * (x - bounds[0]) / spanX, height * (bounds[3] - y) / spanY];
  const shapes = definition.features.map(key => {
    const [file, featureId] = sources[key];
    const collection = JSON.parse(readFileSync(`public/maps/geometry/${file}.geojson`, "utf8"));
    const feature = collection.features.find(f => f.properties.id === featureId);
    if (!feature) throw new Error(`Missing geography: ${file}/${featureId}`);
    const { type, coordinates } = feature.geometry;
    if (!["Polygon", "LineString"].includes(type)) throw new Error(`Unsupported geometry: ${type}`);
    const lines = type === "Polygon" ? coordinates : [coordinates];
    const path = lines.map(line => line.map((p, i) => `${i ? "L" : "M"}${project(p).map(n => n.toFixed(2)).join(",")}`).join(" ") + (type === "Polygon" ? "Z" : "")).join(" ");
    return { source: `${file}.geojson#${featureId}`, kind: type === "LineString" ? "river" : feature.properties.land_or_water, path };
  });
  result[id] = { label: definition.label, width, height, bounds, waterBackground: Boolean(definition.waterBackground), shapes };
}
writeFileSync("src/lib/quiz/map-regions-data.json", JSON.stringify(result, null, 2) + "\n");
console.log(`Generated ${Object.keys(result).length} offline quiz map regions from local geography.`);
