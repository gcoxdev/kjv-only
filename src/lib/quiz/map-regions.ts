import regions from "./map-regions-data.json";

export type QuizMapRegion = keyof typeof regions | "north-aegean";
// The original question keeps its existing coordinates, labels and saved answers.
const legacy = {
  label: "Northern Aegean", width: 550, height: 290, waterBackground: true,
  bounds: [24.4 - 60 * 1.8 / 410, 39.7 - 45 * 1.3 / 200, 24.4 + 490 * 1.8 / 410, 39.7 + 245 * 1.3 / 200],
  shapes: [
    { source: "original schematic", kind: "land", path: "M0 0H550V40L170 53 80 78 0 68Z M490 130L550 110V290H455L466 227 485 202Z" },
    { source: "original schematic", kind: "land", path: "M282 130a45 18 0 1 0 90 0a45 18 0 1 0 -90 0" },
  ],
};
export const QUIZ_MAP_REGIONS = { ...regions, "north-aegean": legacy };
export function quizMapRegion(q: { mapRegion?: QuizMapRegion }) {
  return QUIZ_MAP_REGIONS[q.mapRegion ?? "north-aegean"];
}
export function quizMapPoint(q: { mapRegion?: QuizMapRegion }, point: { lon: number; lat: number }) {
  const { bounds: [west, south, east, north], width, height } = quizMapRegion(q);
  return { x: width * (point.lon - west) / (east - west), y: height * (north - point.lat) / (north - south) };
}
