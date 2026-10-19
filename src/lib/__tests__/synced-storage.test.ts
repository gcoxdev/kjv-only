import { afterEach, describe, expect, it, vi } from "vitest";
import { createSyncedStorage, mergeStoredFields, mergeStoredItems, mergeStoredSet, recoveryCodec } from "@/lib/synced-storage";

const item = (id: string, title = id, updatedAt = 1) => ({ id, title, body: "", updatedAt });
function storage() {
  const values = new Map<string, string>();
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const window = Object.assign(new EventTarget(), { localStorage });
  vi.stubGlobal("window", window);
  vi.stubGlobal("navigator", {});
  return localStorage;
}
afterEach(() => vi.unstubAllGlobals());

describe("concurrent personal-data edits", () => {
  it("merges additions, preserves unrelated edits and does not resurrect remote deletions", () => {
    expect(mergeStoredItems([item("a")], [], [item("b")]).map(x => x.id)).toEqual(["a", "b"]);
    expect(mergeStoredItems([], [item("a")], [item("a", "stale edit", 2)])).toEqual([]);
    expect(mergeStoredItems([item("a", "newer", 3)], [item("a")], [item("a", "older", 2)])[0].title).toBe("newer");
    expect(mergeStoredItems([item("a"), item("b")], [item("a")], [])).toEqual([item("b")]);
    expect(mergeStoredItems([{ ...item("a"), body: "other window" }], [item("a")], [item("a", "new title", 2)])[0]).toMatchObject({ title: "new title", body: "other window" });
  });
  it("merges only changed settings and chapter flags", () => {
    expect(mergeStoredFields({ font: 20, space: 0 }, { font: 16, space: 0 }, { font: 16, space: 2 })).toEqual({ font: 20, space: 2 });
    expect([...mergeStoredSet(new Set(["a", "b"]), new Set(["a"]), new Set(["c"]))]).toEqual(["b", "c"]);
  });
  it("rereads before writing and updates subscribers on another window's change", () => {
    const ls = storage();
    const codec = { parse: (raw: string | null) => JSON.parse(raw ?? "[]") as ReturnType<typeof item>[], stringify: JSON.stringify };
    const a = createSyncedStorage("notes", codec, mergeStoredItems, []);
    const b = createSyncedStorage("notes", codec, mergeStoredItems, []);
    const unsubscribe = b.subscribe(() => {});
    expect(ls.getItem("notes")).toBeNull(); // Hydration never overwrites storage.
    a.update(current => [...current, item("a")]);
    b.update(current => [...current, item("b")]); // No storage event has arrived yet.
    expect(JSON.parse(ls.getItem("notes")!).map((x: { id: string }) => x.id)).toEqual(["a", "b"]);
    a.update(current => current.filter(x => x.id !== "b"));
    const event = Object.assign(new Event("storage"), { key: "notes", storageArea: ls });
    window.dispatchEvent(event);
    expect(b.getSnapshot()).toEqual([item("a")]);
    unsubscribe();
  });
  it("serializes simultaneous saves with Web Locks", async () => {
    const ls = storage();
    let queue = Promise.resolve();
    vi.stubGlobal("navigator", { locks: { request: (_key: string, job: () => void) => (queue = queue.then(job)) } });
    const codec = { parse: (raw: string | null) => JSON.parse(raw ?? "[]") as ReturnType<typeof item>[], stringify: JSON.stringify };
    const a = createSyncedStorage("notes", codec, mergeStoredItems, []);
    const b = createSyncedStorage("notes", codec, mergeStoredItems, []);
    a.update([item("a")]); b.update([item("b")]);
    await queue;
    expect(JSON.parse(ls.getItem("notes")!).map((x: { id: string }) => x.id)).toEqual(["a", "b"]);
  });
  it("refuses to overwrite unreadable data when the recovery copy cannot be saved", () => {
    const ls = storage();
    ls.setItem("notes", "broken original");
    ls.setItem = () => { throw new Error("quota"); };
    const codec = recoveryCodec("notes", () => { throw new Error("invalid"); });
    expect(() => codec.parse("broken original")).toThrow("Could not preserve");
    expect(ls.getItem("notes")).toBe("broken original");
  });
  it("preserves the original raw invalid data before allowing a corrected save", () => {
    const ls = storage();
    const codec = recoveryCodec("notes", raw => ({ entries: JSON.parse(raw).filter((x: unknown) => x !== null), skippedInvalidCount: 1 }));
    const raw = '[null,{"id":"a"}]';
    expect(codec.parse(raw)).toEqual([{ id: "a" }]);
    expect(ls.getItem("notes.recovered")).toBe(raw);
    codec.parse("invalid JSON");
    expect(ls.getItem("notes.recovered")).toBe(raw);
  });
});
