import type { Book } from "@/types/bible";
import { GENEALOGY_COMPOUND_WORDS } from "@/lib/genealogy-names";
import {
  type AncientMapPayload,
  type MapGeoJsonPayload,
} from "@/lib/maps";
import type {
  AIDictionaryPayload,
  ConcordancePayload,
  CrossRefsPayload,
  GenealogyCompactPayload,
  GenealogyPayload,
  HitchcocksPayload,
  BibleWordBookPayload,
  OldEnglishPayload,
  PhrasesPayload,
  StrongsCompactPayload,
  StrongsPayload,
  UnitsPayload,
  WebstersPayload,
} from "@/types/reader";
import {
  decodeGenealogyPayload,
  GENEALOGY_ENRICHMENT_VERSION,
} from "@/lib/genealogy";
import { normalizeConcordanceWord } from "@/lib/references";
import { decodeStrongsPayload } from "@/lib/strongs";
import { parseBooks } from "@/lib/bible-payload";
import { beginPerformanceMeasure } from "@/lib/performance";
import {
  KJV_CORPUS_MANIFEST_URL,
  matchesKjvCorpusAsset,
  parseKjvCorpusManifest,
  type KjvCorpusManifest,
  type KjvCorpusAsset,
} from "@/lib/kjv-corpus-manifest";

let kjvBooksPromise: Promise<Book[]> | null = null;
let kjvBootstrapPromise: Promise<Book[]> | null = null;
let kjvManifestPromise: Promise<KjvCorpusManifest> | null = null;
let concordancePromise: Promise<ConcordancePayload> | null = null;
let crossRefsPromise: Promise<CrossRefsPayload> | null = null;
let hitchcocksPromise: Promise<HitchcocksPayload> | null = null;
let bibleWordBookPromise: Promise<BibleWordBookPayload> | null = null;
let oldEnglishPromise: Promise<OldEnglishPayload> | null = null;
let phrasesPromise: Promise<PhrasesPayload> | null = null;
let unitsPromise: Promise<UnitsPayload> | null = null;
let genealogyCompactPromise: Promise<GenealogyCompactPayload> | null = null;
let genealogyCandidateNamesPromise: Promise<Set<string>> | null = null;
let genealogyPromise: Promise<GenealogyPayload> | null = null;
let webstersPromise: Promise<WebstersPayload> | null = null;
let aiDictionaryPromise: Promise<AIDictionaryPayload> | null = null;
let strongsGreekPromise: Promise<StrongsPayload> | null = null;
let strongsHebrewPromise: Promise<StrongsPayload> | null = null;
let ancientMapPromise: Promise<AncientMapPayload> | null = null;
let dailyScriptureTopicsPromise: Promise<DailyScriptureTopicsPayload> | null = null;
let topicsIndexPromise: Promise<TopicsIndexPayload> | null = null;
const mapGeoJsonPromiseCache = new Map<string, Promise<MapGeoJsonPayload>>();
export const GENEALOGY_ASSET_VERSION = GENEALOGY_ENRICHMENT_VERSION;
export const STRONGS_ASSET_VERSION = "20260313-derivation-links-2";
const GENEALOGY_ENRICHED_CANDIDATE_WORDS = new Set([
  ...GENEALOGY_COMPOUND_WORDS,
  "jesus",
  "christ",
  "immanuel",
  "emmanuel",
]);

export type DailyScriptureTopicsPayload = {
  generatedAt: string;
  source: string;
  keepFraction: number;
  topics: Array<{
    topic: string;
    references: string[];
  }>;
};

export type TopicsIndexPayload = {
  generatedAt: string;
  source: string;
  topics: Array<{
    topic: string;
    references: string[];
  }>;
};

async function fetchKjvBooksOnMainThread(url: string) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }
  const parsedBooks = parseBooks((await response.json()) as unknown);
  if (!parsedBooks || parsedBooks.length === 0) {
    throw new Error(`Invalid reader data format in ${url}`);
  }
  return parsedBooks;
}

function fetchKjvBooksInWorker(url: string) {
  return new Promise<Book[]>((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/reader-data.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.addEventListener(
      "message",
      (event: MessageEvent<{ books?: Book[]; payload?: unknown; error?: string }>) => {
        worker.terminate();
        const books = parseBooks(event.data.payload ?? event.data.books);
        if (books && books.length > 0) {
          resolve(books);
          return;
        }
        reject(new Error(event.data.error ?? `Could not load ${url}`));
      },
      { once: true },
    );
    worker.addEventListener(
      "error",
      () => {
        worker.terminate();
        reject(new Error("Bible data worker failed"));
      },
      { once: true },
    );
    worker.postMessage({ url });
  });
}

export function loadKjvManifest() {
  if (!kjvManifestPromise) {
    kjvManifestPromise = fetch(KJV_CORPUS_MANIFEST_URL, { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load ${KJV_CORPUS_MANIFEST_URL}`);
        }
        const manifest = parseKjvCorpusManifest(
          (await response.json()) as unknown,
        );
        if (!manifest) {
          throw new Error(`Invalid corpus manifest in ${KJV_CORPUS_MANIFEST_URL}`);
        }
        return manifest;
      })
      .catch((error) => {
        kjvManifestPromise = null;
        throw error;
      });
  }

  return kjvManifestPromise;
}

export function loadKjvBootstrap() {
  if (!kjvBootstrapPromise) {
    const finishMeasure = beginPerformanceMeasure("kjv:bootstrap-load");
    kjvBootstrapPromise = loadKjvManifest()
      .then(async (manifest) => ({
        manifest,
        books: await fetchKjvBooksOnMainThread(manifest.bootstrap.url),
      }))
      .then(({ books, manifest }) => {
        if (
          books[0]?.name !== "Genesis" ||
          books[0]?.chapters[0]?.chapter !== 1
        ) {
          throw new Error("Invalid Genesis 1 bootstrap corpus");
        }
        if (!matchesKjvCorpusAsset(books, manifest.bootstrap)) {
          throw new Error("Invalid bootstrap corpus counts");
        }
        return books;
      })
      .finally(finishMeasure)
      .catch((error) => {
        kjvBootstrapPromise = null;
        throw error;
      });
  }

  return kjvBootstrapPromise;
}

export function loadKjvBooks() {
  if (!kjvBooksPromise) {
    const finishMeasure = beginPerformanceMeasure("kjv:corpus-load");
    kjvBooksPromise = loadKjvManifest()
      .then(async (manifest) => {
        const loadAsset = async (asset: KjvCorpusAsset) => {
          const books = await (typeof Worker === "function"
            ? fetchKjvBooksInWorker(asset.url).catch(() => fetchKjvBooksOnMainThread(asset.url))
            : fetchKjvBooksOnMainThread(asset.url));
          if (books[0]?.name !== "Genesis") throw new Error("Invalid canonical Bible corpus order");
          if (!matchesKjvCorpusAsset(books, asset)) throw new Error("Invalid full Bible corpus counts");
          return books;
        };
        if (manifest.compact) {
          try { return await loadAsset(manifest.compact); }
          catch { /* Older offline installations may only have the legacy corpus. */ }
        }
        return loadAsset(manifest.full);
      })
      .finally(finishMeasure)
      .catch((error) => {
        kjvBooksPromise = null;
        throw error;
      });
  }

  return kjvBooksPromise;
}

export function loadConcordance() {
  if (!concordancePromise) {
    concordancePromise = fetch(
      "/references/concordance.compact.delta.min.json",
      { cache: "no-cache" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "Could not load /references/concordance.compact.delta.min.json",
          );
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as ConcordancePayload)
      .catch((error) => {
        concordancePromise = null;
        throw error;
      });
  }

  return concordancePromise;
}

export function loadCrossRefs() {
  if (!crossRefsPromise) {
    crossRefsPromise = fetch("/references/cross-refs.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/cross-refs.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as CrossRefsPayload)
      .catch((error) => {
        crossRefsPromise = null;
        throw error;
      });
  }

  return crossRefsPromise;
}

export function loadWebsters() {
  if (!webstersPromise) {
    webstersPromise = fetch("/references/websters.json", { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/websters.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as WebstersPayload)
      .catch((error) => {
        webstersPromise = null;
        throw error;
      });
  }

  return webstersPromise;
}

export function loadAIDictionary() {
  if (!aiDictionaryPromise) {
    aiDictionaryPromise = fetch("/references/ai-dictionary.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/ai-dictionary.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as AIDictionaryPayload)
      .catch((error) => {
        aiDictionaryPromise = null;
        throw error;
      });
  }

  return aiDictionaryPromise;
}

export function loadHitchcocks() {
  if (!hitchcocksPromise) {
    hitchcocksPromise = fetch("/references/hitchcocks.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/hitchcocks.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as HitchcocksPayload)
      .catch((error) => {
        hitchcocksPromise = null;
        throw error;
      });
  }

  return hitchcocksPromise;
}

export function loadBibleWordBook() {
  if (!bibleWordBookPromise) {
    bibleWordBookPromise = fetch("/references/bible-word-book.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/bible-word-book.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as BibleWordBookPayload)
      .catch((error) => {
        bibleWordBookPromise = null;
        throw error;
      });
  }

  return bibleWordBookPromise;
}

export function loadOldEnglish() {
  if (!oldEnglishPromise) {
    oldEnglishPromise = fetch("/references/old-english.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/old-english.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as OldEnglishPayload)
      .catch((error) => {
        oldEnglishPromise = null;
        throw error;
      });
  }

  return oldEnglishPromise;
}

export function loadPhrases() {
  if (!phrasesPromise) {
    phrasesPromise = fetch("/references/phrases.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/phrases.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as PhrasesPayload)
      .catch((error) => {
        phrasesPromise = null;
        throw error;
      });
  }

  return phrasesPromise;
}

export function loadUnits() {
  if (!unitsPromise) {
    unitsPromise = fetch("/references/units.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/units.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as UnitsPayload)
      .catch((error) => {
        unitsPromise = null;
        throw error;
      });
  }

  return unitsPromise;
}

function loadGenealogyCompact() {
  if (!genealogyCompactPromise) {
    genealogyCompactPromise = fetch(
      `/references/genealogy.compact.min.json?v=${GENEALOGY_ASSET_VERSION}`,
      { cache: "no-cache" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/genealogy.compact.min.json");
        }
        const compact = await response.json() as GenealogyCompactPayload;
        if (compact?.x !== GENEALOGY_ENRICHMENT_VERSION) {
          throw new Error("Genealogy data needs an update. Connect to the internet and refresh the Core Bible Data bundle in Downloads.");
        }
        return compact;
      })
      .catch((error) => {
        genealogyCompactPromise = null;
        genealogyCandidateNamesPromise = null;
        throw error;
      });
  }

  return genealogyCompactPromise;
}

export function isGenealogyCandidateWord(
  compact: GenealogyCompactPayload,
  rawWord: string,
) {
  const normalizedWord = normalizeConcordanceWord(rawWord)
    .toLowerCase()
    .replace(/-/g, "");
  if (!normalizedWord) {
    return false;
  }
  if (GENEALOGY_ENRICHED_CANDIDATE_WORDS.has(normalizedWord)) {
    return true;
  }

  return compact.w.some(
    (name) =>
      normalizeConcordanceWord(name).toLowerCase().replace(/-/g, "") ===
      normalizedWord,
  );
}

export function mayHaveGenealogyMatch(rawWord: string) {
  if (!genealogyCandidateNamesPromise) {
    genealogyCandidateNamesPromise = loadGenealogyCompact().then(
      (compact) =>
        new Set(
          [
            ...GENEALOGY_ENRICHED_CANDIDATE_WORDS,
            ...compact.w.map((name) =>
              normalizeConcordanceWord(name).toLowerCase().replace(/-/g, ""),
            ),
          ].filter(Boolean),
        ),
    );
  }

  const normalizedWord = normalizeConcordanceWord(rawWord)
    .toLowerCase()
    .replace(/-/g, "");
  if (!normalizedWord) {
    return Promise.resolve(false);
  }

  return genealogyCandidateNamesPromise.then((names) =>
    names.has(normalizedWord),
  );
}

export function loadGenealogy() {
  if (!genealogyPromise) {
    genealogyPromise = loadGenealogyCompact()
      .then((payload) => decodeGenealogyPayload(payload))
      .catch((error) => {
        genealogyPromise = null;
        throw error;
      });
  }

  return genealogyPromise;
}

export function loadStrongsGreek() {
  if (!strongsGreekPromise) {
    strongsGreekPromise = fetch(
      `/references/strongs-greek.compact.min.json?v=${STRONGS_ASSET_VERSION}`,
      { cache: "no-cache" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/strongs-greek.compact.min.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => decodeStrongsPayload(payload as StrongsCompactPayload))
      .catch((error) => {
        strongsGreekPromise = null;
        throw error;
      });
  }

  return strongsGreekPromise;
}

export function loadStrongsHebrew() {
  if (!strongsHebrewPromise) {
    strongsHebrewPromise = fetch(
      `/references/strongs-hebrew.compact.min.json?v=${STRONGS_ASSET_VERSION}`,
      { cache: "no-cache" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /references/strongs-hebrew.compact.min.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => decodeStrongsPayload(payload as StrongsCompactPayload))
      .catch((error) => {
        strongsHebrewPromise = null;
        throw error;
      });
  }

  return strongsHebrewPromise;
}

export function loadAncientMap() {
  if (!ancientMapPromise) {
    ancientMapPromise = fetch("/maps/data/map.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /maps/data/map.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as AncientMapPayload)
      .catch((error) => {
        ancientMapPromise = null;
        throw error;
      });
  }

  return ancientMapPromise;
}

export function loadDailyScriptureTopics() {
  if (!dailyScriptureTopicsPromise) {
    dailyScriptureTopicsPromise = fetch("/topics/daily-scripture-topics.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /topics/daily-scripture-topics.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as DailyScriptureTopicsPayload)
      .catch((error) => {
        dailyScriptureTopicsPromise = null;
        throw error;
      });
  }

  return dailyScriptureTopicsPromise;
}

export function loadTopicsIndex() {
  if (!topicsIndexPromise) {
    topicsIndexPromise = fetch("/topics/topics-index.json", {
      cache: "no-cache",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load /topics/topics-index.json");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => payload as TopicsIndexPayload)
      .catch((error) => {
        topicsIndexPromise = null;
        throw error;
      });
  }

  return topicsIndexPromise;
}

export function loadMapGeoJson(geojsonFile: string) {
  const cached = mapGeoJsonPromiseCache.get(geojsonFile);
  if (cached) {
    return cached;
  }

  const promise = fetch(`/maps/geometry/${geojsonFile}`, {
    cache: "no-cache",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Could not load /maps/geometry/${geojsonFile}`);
      }
      return response.json() as Promise<unknown>;
    })
    .then((payload) => payload as MapGeoJsonPayload)
    .catch((error) => {
      mapGeoJsonPromiseCache.delete(geojsonFile);
      throw error;
    });
  mapGeoJsonPromiseCache.set(geojsonFile, promise);
  return promise;
}
