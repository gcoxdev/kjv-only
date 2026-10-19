import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("builds plain-text map labels and preserves compact USX/OSIS references", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kjv-map-build-"));
  try {
    const ancient = path.join(directory, "ancient.jsonl");
    const modern = path.join(directory, "modern.jsonl");
    const output = path.join(directory, "map.json");
    writeFileSync(ancient, JSON.stringify({
      id: "test",
      geojson_file: "test.geojson",
      translation_name_counts: { Dan: 1 },
      types: ["city"],
      verses: [
        { usx: "GEN 14:14", osis: "Ignored.1.1" },
        { osis: "Judg.18.29" },
        { osis: "1Kgs.12.29" },
        { osis: "Ps.1.1" },
        { osis: "Matt.1.1" },
        { osis: "Judg.18.29" },
        {},
      ],
      identifications: [{
        description: "<<modern>Tel\n Dan</modern>>",
        resolutions: [{ geojson_roles: { point: { id: "site.point" } } }],
      }],
    }));
    writeFileSync(modern, "");
    writeFileSync(path.join(directory, "test.geojson"), JSON.stringify({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { id: "site.point" },
        geometry: { type: "Point", coordinates: [35, 33] },
      }],
    }));
    execFileSync(process.execPath, [
      "--experimental-strip-types", "scripts/build-map-json.mjs",
      "--ancient", ancient, "--modern", modern, "--geometry", directory,
      "--output", output, "--report", path.join(directory, "report.json"),
      "--legacy", path.join(directory, "absent.json"),
    ], { stdio: "pipe" });

    const entries = JSON.parse(readFileSync(output, "utf8"));
    expect(entries).toHaveLength(1);
    expect(entries[0].verses).toEqual([
      "GEN.14.14", "JDG.18.29", "1KI.12.29", "PSA.1.1", "MAT.1.1",
    ]);
    expect(entries[0].modern_names).toEqual(["Tel Dan"]);
    expect(entries[0].identifications[0].label).toBe("Tel Dan");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
