import { readFileSync } from "node:fs";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

function worker() {
  const origin = "https://reader.test";
  const url = (input: Request | string) => new URL(typeof input === "string" ? input : input.url, origin).href;
  const stores = new Map<string, Map<string, Response>>();
  const puts = vi.fn();
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const values = stores.get(name)!;
      return {
        keys: async () => [...values.keys()].map(key => new Request(key)),
        match: async (key: Request | string) => values.get(url(key))?.clone(),
        put: async (key: Request | string, response: Response) => { puts(name, url(key)); values.set(url(key), response.clone()); },
      };
    },
  };
  const events: Record<string, (event: unknown) => void> = {};
  const fetch = vi.fn<typeof globalThis.fetch>();
  const context = vm.createContext({ URL, Response, Request, setTimeout, clearTimeout, caches, fetch, self: {
    location: { href: `${origin}/sw.js?cacheName=kjv-only-cache-new&cachePrefix=kjv-only-cache-`, origin },
    addEventListener: (type: string, callback: (event: unknown) => void) => { events[type] = callback; },
    clients: { claim: vi.fn() },
  } });
  vm.runInContext(readFileSync("public/sw.js", "utf8"), context);
  const jobs: Promise<unknown>[] = [];
  return {
    caches, fetch, puts,
    activate: async () => { events.activate({ waitUntil: (job: Promise<unknown>) => jobs.push(job) }); await Promise.all(jobs); },
    request: (path: string) => {
      let response: Promise<Response> | undefined;
      events.fetch({ request: new Request(origin + path), respondWith: (job: Promise<Response>) => { response = job; }, waitUntil: (job: Promise<unknown>) => { jobs.push(job); } });
      return response!;
    },
    finish: () => Promise.all(jobs),
  };
}
afterEach(() => vi.useRealTimers());
describe("shipped service worker", () => {
  it("can start offline using the data precached with the new app shell", async () => {
    const w = worker();
    await (await w.caches.open("kjv-only-cache-new")).put("/data/kjv-bootstrap.json", new Response("bootstrap"));
    w.fetch.mockRejectedValueOnce(new TypeError("offline"));
    expect(await (await w.request("/data/kjv-bootstrap.json")).text()).toBe("bootstrap");
  });
  it("refetches topics and uses the saved copy when offline", async () => {
    const w = worker();
    const cache = await w.caches.open("kjv-only-downloads-v1");
    await cache.put("/topics/topics-index.json", new Response("old"));
    w.fetch.mockResolvedValueOnce(new Response("new"));
    expect(await (await w.request("/topics/topics-index.json")).text()).toBe("new");
    await w.finish();
    w.fetch.mockRejectedValueOnce(new TypeError("offline"));
    expect(await (await w.request("/topics/topics-index.json")).text()).toBe("new");
  });
  it("serves cached data after a timeout and still refreshes in the background", async () => {
    vi.useFakeTimers();
    const w = worker();
    const cache = await w.caches.open("kjv-only-downloads-v1");
    await cache.put("/data/kjv.json", new Response("saved"));
    let release!: (value: Response) => void;
    w.fetch.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const result = w.request("/data/kjv.json");
    await vi.advanceTimersByTimeAsync(3501);
    expect(await (await result).text()).toBe("saved");
    release(new Response("refreshed"));
    await w.finish();
    expect(await (await cache.match("/data/kjv.json"))?.text()).toBe("refreshed");
  });
  it("does not rewrite large data when a validator is unchanged", async () => {
    const w = worker();
    const cache = await w.caches.open("kjv-only-downloads-v1");
    await cache.put("/data/kjv.json", new Response("saved", { headers: { etag: '"v1"' } }));
    w.puts.mockClear();
    w.fetch.mockResolvedValueOnce(new Response("saved", { headers: { etag: '"v1"' } }));
    await w.request("/data/kjv.json"); await w.finish();
    expect(w.puts).not.toHaveBeenCalled();
    w.fetch.mockResolvedValueOnce(new Response("changed", { headers: { etag: '"v2"' } }));
    await w.request("/data/kjv.json"); await w.finish();
    expect(await (await cache.match("/data/kjv.json"))?.text()).toBe("changed");
  });
  it("keeps the old cache intact if copying downloads fails", async () => {
    const w = worker();
    const old = await w.caches.open("kjv-only-cache-v10");
    await old.put("/audio/GEN.1.mp3", new Response("audio"));
    w.puts.mockImplementationOnce(() => { throw new Error("quota"); });
    await expect(w.activate()).rejects.toThrow("quota");
    expect(await w.caches.keys()).toContain("kjv-only-cache-v10");
    expect(await (await old.match("/audio/GEN.1.mp3"))?.text()).toBe("audio");
  });
  it("migrates legacy downloads before pruning obsolete app builds", async () => {
    const w = worker();
    const old = await w.caches.open("kjv-only-cache-v10");
    await old.put("/audio/GEN.1.mp3", new Response("audio"));
    await old.put("/maps/geometry/test.geojson", new Response("map"));
    await old.put("/offline-inventory.json", new Response("inventory"));
    await old.put("/assets/old.js", new Response("obsolete"));
    await w.caches.open("unrelated");
    const downloads = await w.caches.open("kjv-only-downloads-v1");
    await downloads.put("/audio/GEN.1.mp3", new Response("newer audio"));
    await w.activate();
    expect(await w.caches.keys()).toEqual(["unrelated", "kjv-only-downloads-v1"]);
    expect(await (await downloads.match("/audio/GEN.1.mp3"))?.text()).toBe("newer audio");
    expect(await (await downloads.match("/maps/geometry/test.geojson"))?.text()).toBe("map");
    expect(await (await downloads.match("/offline-inventory.json"))?.text()).toBe("inventory");
    expect(await downloads.match("/assets/old.js")).toBeUndefined();
  });
});
