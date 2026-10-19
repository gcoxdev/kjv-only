import { resolvePersonPlaceContext, AMBIGUOUS_PERSON_PLACE_NOTICE } from "@/lib/person-place-context";
import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { STUDY_ACCORDION_ITEMS } from "@/hooks/use-study-sidebar-state";
import type { AncientMapEntry, AncientMapPayload } from "@/lib/maps";
import { beginPerformanceMeasure } from "@/lib/performance";
import { mayHaveGenealogyMatch } from "@/lib/reader-data";
import {
  chapterVerseKey,
  decodeConcordanceReferences,
  normalizeStrongsCodes,
  resolveAIDictionaryKey,
  resolveBibleWordBookKey,
  resolveConcordanceKey,
  resolveHitchcocksKey,
  resolveOldEnglishKey,
  resolveUnitsKey,
  resolveWebstersKey,
} from "@/lib/references";
import {
  findGenealogyMatches,
  findMapMatches,
  resolveAIDictionarySelectionAtLocation,
  resolvePhraseSelectionAtLocation,
} from "@/lib/word-study-selection";
import type { Book } from "@/types/bible";
import type { NotesContext } from "@/types/notes";
import type {
  AIDictionaryEntry,
  AIDictionaryPayload,
  BibleWordBookEntry,
  BibleWordBookPayload,
  ConcordancePayload,
  GenealogyPayload,
  HitchcocksPayload,
  OldEnglishPayload,
  PhraseEntry,
  PhrasesPayload,
  StrongsPayload,
  StudyToolsDestination,
  StudyWorkspaceTool,
  UnitsEntry,
  UnitsPayload,
  WebstersEntry,
  WebstersPayload,
} from "@/types/reader";
import {
  resolveStrongsEntries,
  type StrongsSearchResult,
} from "@/hooks/use-strongs-search-tool";

type Setter<T> = (value: T) => void;

type WordStudyCoordinatorParams = {
  books: Book[];
  concordance: ConcordancePayload | null;
  websters: WebstersPayload | null;
  aiDictionary: AIDictionaryPayload | null;
  bibleWordBook: BibleWordBookPayload | null;
  hitchcocks: HitchcocksPayload | null;
  oldEnglish: OldEnglishPayload | null;
  phrases: PhrasesPayload | null;
  units: UnitsPayload | null;
  genealogy: GenealogyPayload | null;
  ancientMaps: AncientMapPayload | null;
  strongsGreek: StrongsPayload | null;
  strongsHebrew: StrongsPayload | null;
  ensureConcordanceLoaded: () => Promise<ConcordancePayload>;
  ensureWebstersLoaded: () => Promise<WebstersPayload>;
  ensureAIDictionaryLoaded: () => Promise<AIDictionaryPayload>;
  ensureBibleWordBookLoaded: () => Promise<BibleWordBookPayload>;
  ensureHitchcocksLoaded: () => Promise<HitchcocksPayload>;
  ensureOldEnglishLoaded: () => Promise<OldEnglishPayload>;
  ensurePhrasesLoaded: () => Promise<PhrasesPayload>;
  ensureUnitsLoaded: () => Promise<UnitsPayload>;
  ensureGenealogyLoaded: () => Promise<GenealogyPayload>;
  ensureAncientMapsLoaded: () => Promise<AncientMapPayload>;
  ensureStrongsLoaded: () => Promise<{
    greek: StrongsPayload;
    hebrew: StrongsPayload;
  }>;
  openStudyTool: (
    tool: StudyWorkspaceTool,
    options?: { sourceLeafId?: string | null },
  ) => StudyToolsDestination | null | void;
  onPanelWordSelection?: (
    leafId: string,
    selection: OpenWordInStudyToolsArgs,
  ) => void;
  setNotesContext: Setter<NotesContext | null>;
  setConcordanceAccordionValue: Dispatch<SetStateAction<string[]>>;
  setConcordanceError: Setter<string | null>;
  setIsConcordanceLoading: Setter<boolean>;
  setConcordanceSearchTerm: Setter<string>;
  setConcordanceWordAccordionValue: Setter<string[]>;
  setSelectedConcordanceWord: Setter<{
    key: string;
    references: string[];
  } | null>;
  setWebstersSearchTerm: Setter<string>;
  setWebstersWordAccordionValue: Setter<string[]>;
  setSelectedWebstersEntry: Setter<{
    key: string;
    entry: WebstersEntry;
  } | null>;
  setAIDictionarySearchTerm: Setter<string>;
  setAIDictionaryWordAccordionValue: Setter<string[]>;
  setSelectedAIDictionaryEntry: Setter<{
    key: string;
    entry: AIDictionaryEntry;
  } | null>;
  setBibleWordBookSearchTerm: Setter<string>;
  setBibleWordBookWordAccordionValue: Setter<string[]>;
  setSelectedBibleWordBookEntry: Setter<{
    key: string;
    entry: BibleWordBookEntry;
  } | null>;
  setHitchcocksSearchTerm: Setter<string>;
  setSelectedHitchcocksEntry: Setter<{
    key: string;
    definition: string;
  } | null>;
  setOldEnglishSearchTerm: Setter<string>;
  setSelectedOldEnglishEntry: Setter<{
    key: string;
    definitions: string[];
  } | null>;
  setPhrasesSearchTerm: Setter<string>;
  setSelectedPhrasesEntry: Setter<{
    key: string;
    entry: PhraseEntry;
  } | null>;
  setUnitsSearchTerm: Setter<string>;
  setSelectedUnitsEntry: Setter<{
    key: string;
    entry: UnitsEntry;
  } | null>;
  setGenealogySearchTerm: Setter<string>;
  setSelectedGenealogyIds: Setter<string[]>;
  setMapsSearchTerm: Setter<string>;
  setSelectedMapsEntries: Setter<AncientMapEntry[]>;
  setStrongsError: Setter<string | null>;
  setIsStrongsLoading: Setter<boolean>;
  setStrongsSearchTerm: Setter<string>;
  setIsStrongsSearching: Setter<boolean>;
  setStrongsWordAccordionValue: Setter<string[]>;
  setSelectedStrongsEntries: Setter<StrongsSearchResult[]>;
  strongsSearchInputRef: RefObject<HTMLInputElement | null>;
};

export type OpenWordInStudyToolsArgs = {
  rawWord: string;
  bookIndex: number;
  chapterIndex: number;
  verseNumber: number | null;
  tokenIndex: number | null;
  strongCodes: string[];
  sourceLeafId: string | null;
};

export function useWordStudyCoordinator({
  books,
  concordance,
  websters,
  aiDictionary,
  bibleWordBook,
  hitchcocks,
  oldEnglish,
  phrases,
  units,
  genealogy,
  ancientMaps,
  strongsGreek,
  strongsHebrew,
  ensureConcordanceLoaded,
  ensureWebstersLoaded,
  ensureAIDictionaryLoaded,
  ensureBibleWordBookLoaded,
  ensureHitchcocksLoaded,
  ensureOldEnglishLoaded,
  ensurePhrasesLoaded,
  ensureUnitsLoaded,
  ensureGenealogyLoaded,
  ensureAncientMapsLoaded,
  ensureStrongsLoaded,
  openStudyTool,
  onPanelWordSelection,
  setNotesContext,
  setConcordanceAccordionValue,
  setConcordanceError,
  setIsConcordanceLoading,
  setConcordanceSearchTerm,
  setConcordanceWordAccordionValue,
  setSelectedConcordanceWord,
  setWebstersSearchTerm,
  setWebstersWordAccordionValue,
  setSelectedWebstersEntry,
  setAIDictionarySearchTerm,
  setAIDictionaryWordAccordionValue,
  setSelectedAIDictionaryEntry,
  setBibleWordBookSearchTerm,
  setBibleWordBookWordAccordionValue,
  setSelectedBibleWordBookEntry,
  setHitchcocksSearchTerm,
  setSelectedHitchcocksEntry,
  setOldEnglishSearchTerm,
  setSelectedOldEnglishEntry,
  setPhrasesSearchTerm,
  setSelectedPhrasesEntry,
  setUnitsSearchTerm,
  setSelectedUnitsEntry,
  setGenealogySearchTerm,
  setSelectedGenealogyIds,
  setMapsSearchTerm,
  setSelectedMapsEntries,
  setStrongsError,
  setIsStrongsLoading,
  setStrongsSearchTerm,
  setIsStrongsSearching,
  setStrongsWordAccordionValue,
  setSelectedStrongsEntries,
  strongsSearchInputRef,
}: WordStudyCoordinatorParams) {
  const requestIdRef = useRef(0);
  const [personPlaceNotice, setPersonPlaceNotice] = useState<string | null>(null);

  function openWordInStudyTools(selection: OpenWordInStudyToolsArgs) {
    const {
      rawWord,
      bookIndex,
      chapterIndex,
      verseNumber,
      tokenIndex,
      strongCodes,
      sourceLeafId,
    } = selection;
    const normalizedStrongCodes = normalizeStrongsCodes(strongCodes);
    setNotesContext(
      verseNumber !== null
        ? { bookIndex, chapterIndex, verseNumber, word: rawWord }
        : { bookIndex, chapterIndex, word: rawWord },
    );

    const selectionTarget = openStudyTool("concordance", { sourceLeafId });
    if (selectionTarget?.type === "panel") {
      onPanelWordSelection?.(selectionTarget.leafId, selection);
      return selectionTarget;
    }

    setPersonPlaceNotice(null);
    const requestId = ++requestIdRef.current;
    const isCurrentRequest = () => requestIdRef.current === requestId;
    const finishConcordanceMeasure = beginPerformanceMeasure(
      "kjv:study-word-concordance-selection",
    );
    const finishFirstToolsMeasure = beginPerformanceMeasure(
      "kjv:study-word-first-tools",
    );
    const finishAllToolsMeasure = beginPerformanceMeasure(
      "kjv:study-word-all-tools",
    );
    const matchingAccordionItems = new Set<string>(
      verseNumber !== null
        ? ["cross-refs", "concordance"]
        : ["concordance"],
    );
    setConcordanceAccordionValue([...matchingAccordionItems]);
    const updateAccordionMatch = (
      item: (typeof STUDY_ACCORDION_ITEMS)[number],
      matches: boolean,
    ) => {
      if (!isCurrentRequest() || matchingAccordionItems.has(item) === matches) {
        return;
      }
      if (matches) {
        matchingAccordionItems.add(item);
      } else {
        matchingAccordionItems.delete(item);
      }
      // Each result changes only its own match. Replacing every section here
      // would undo manual opens/closes while another dictionary is loading.
      setConcordanceAccordionValue((current) => {
        if (!isCurrentRequest()) return current;
        if (!matches) return current.filter((candidate) => candidate !== item);
        if (current.includes(item)) return current;
        return STUDY_ACCORDION_ITEMS.filter(
          (candidate) => candidate === item || current.includes(candidate),
        );
      });
    };

    setConcordanceError(null);
    setIsConcordanceLoading(true);
    setConcordanceSearchTerm("");
    setWebstersSearchTerm("");
    setAIDictionarySearchTerm("");
    setBibleWordBookSearchTerm("");
    setHitchcocksSearchTerm("");
    setOldEnglishSearchTerm("");
    setPhrasesSearchTerm("");
    setUnitsSearchTerm("");
    setGenealogySearchTerm("");
    setMapsSearchTerm("");
    setWebstersWordAccordionValue([]);
    setAIDictionaryWordAccordionValue([]);
    setBibleWordBookWordAccordionValue([]);
    setSelectedWebstersEntry(null);
    setSelectedAIDictionaryEntry(null);
    setSelectedBibleWordBookEntry(null);
    setSelectedHitchcocksEntry(null);
    setSelectedOldEnglishEntry(null);
    setSelectedPhrasesEntry(null);
    setSelectedUnitsEntry(null);
    setSelectedGenealogyIds([]);
    setSelectedMapsEntries([]);
    setStrongsWordAccordionValue([]);
    setSelectedStrongsEntries([]);

    const applyConcordanceSelection = (data: ConcordancePayload) => {
      if (!isCurrentRequest()) {
        return data;
      }
      const matchedKey = resolveConcordanceKey(data, rawWord) ?? rawWord;
      const references = decodeConcordanceReferences(data, matchedKey);
      setConcordanceWordAccordionValue([]);
      setSelectedConcordanceWord({ key: matchedKey, references });
      updateAccordionMatch("concordance", references.length > 0);
      setIsConcordanceLoading(false);
      finishConcordanceMeasure();
      return data;
    };

    const concordancePromise = concordance
      ? Promise.resolve(concordance)
      : ensureConcordanceLoaded().catch(() => null);

    if (concordance) {
      applyConcordanceSelection(concordance);
    } else {
      void concordancePromise
        .then((data) => {
          if (data && isCurrentRequest()) {
            applyConcordanceSelection(data);
          }
        })
        .catch(() => {
          if (!isCurrentRequest()) {
            return;
          }
          setSelectedConcordanceWord(null);
          setConcordanceWordAccordionValue([]);
          setIsConcordanceLoading(false);
          finishConcordanceMeasure();
        });
    }

    let strongsPromise:
      | Promise<{ greek: StrongsPayload; hebrew: StrongsPayload } | null>
      | null = null;
    if (normalizedStrongCodes.length > 0) {
      setStrongsError(null);
      setIsStrongsLoading(true);
      setStrongsSearchTerm("");
      setIsStrongsSearching(false);
      if (strongsSearchInputRef.current) {
        strongsSearchInputRef.current.value = "";
      }
      strongsPromise =
        strongsGreek && strongsHebrew
          ? Promise.resolve({ greek: strongsGreek, hebrew: strongsHebrew })
          : ensureStrongsLoaded().catch((error) => {
              setStrongsError(
                error instanceof Error
                  ? error.message
                  : "Failed to load Strong's data",
              );
              return null;
            });
    }

    const webstersPromise = websters
      ? Promise.resolve(websters)
      : ensureWebstersLoaded().catch(() => null);
    const aiDictionaryPromise = aiDictionary
      ? Promise.resolve(aiDictionary)
      : ensureAIDictionaryLoaded().catch(() => null);
    const bibleWordBookPromise = bibleWordBook
      ? Promise.resolve(bibleWordBook)
      : ensureBibleWordBookLoaded().catch(() => null);
    const hitchcocksPromise = hitchcocks
      ? Promise.resolve(hitchcocks)
      : ensureHitchcocksLoaded().catch(() => null);
    const oldEnglishPromise = oldEnglish
      ? Promise.resolve(oldEnglish)
      : ensureOldEnglishLoaded().catch(() => null);
    const phrasesPromise = phrases
      ? Promise.resolve(phrases)
      : ensurePhrasesLoaded().catch(() => null);
    const unitsPromise = units
      ? Promise.resolve(units)
      : ensureUnitsLoaded().catch(() => null);
    const ancientMapsPromise = ancientMaps
      ? Promise.resolve(ancientMaps)
      : ensureAncientMapsLoaded().catch(() => null);
    const primaryToolDataPromise = Promise.all([
      webstersPromise,
      aiDictionaryPromise,
      bibleWordBookPromise,
      hitchcocksPromise,
      oldEnglishPromise,
      phrasesPromise,
      unitsPromise,
      ancientMapsPromise,
      strongsPromise ?? Promise.resolve(null),
    ]);
    const genealogyPromise = genealogy
      ? Promise.resolve(genealogy)
      : primaryToolDataPromise
          .then(
            () =>
              new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => resolve());
              }),
          )
          .then(async () => {
            if (!isCurrentRequest()) {
              return null;
            }
            return (await mayHaveGenealogyMatch(rawWord))
              ? ensureGenealogyLoaded()
              : null;
          })
          .catch(() => null);

    void webstersPromise.then((data) => {
      if (!data || !isCurrentRequest()) return;
      const matchedKey = resolveWebstersKey(data, rawWord);
      setSelectedWebstersEntry(
        matchedKey ? { key: matchedKey, entry: data[matchedKey] } : null,
      );
      updateAccordionMatch("websters", Boolean(matchedKey));
      if (matchedKey) finishFirstToolsMeasure();
    });

    void aiDictionaryPromise.then((data) => {
      if (!data || !isCurrentRequest()) return;
      const phraseSelection =
        tokenIndex !== null && verseNumber !== null
          ? resolveAIDictionarySelectionAtLocation(
              books,
              data,
              bookIndex,
              chapterIndex,
              verseNumber,
              tokenIndex,
            )
          : null;
      const matchedKey = resolveAIDictionaryKey(data, rawWord);
      const selection =
        phraseSelection ??
        (matchedKey ? { key: matchedKey, entry: data[matchedKey] } : null);
      setSelectedAIDictionaryEntry(selection);
      updateAccordionMatch("ai-dictionary", Boolean(selection));
      if (selection) finishFirstToolsMeasure();
    });

    void bibleWordBookPromise.then((data) => {
      if (!data || !isCurrentRequest()) return;
      const matchedKey = resolveBibleWordBookKey(data, rawWord);
      setSelectedBibleWordBookEntry(
        matchedKey ? { key: matchedKey, entry: data[matchedKey] } : null,
      );
      updateAccordionMatch("bible-word-book", Boolean(matchedKey));
      if (matchedKey) finishFirstToolsMeasure();
    });

    void hitchcocksPromise.then((data) => {
      if (!data || !isCurrentRequest()) return;
      const matchedKey = resolveHitchcocksKey(data, rawWord);
      setSelectedHitchcocksEntry(
        matchedKey ? { key: matchedKey, definition: data[matchedKey] } : null,
      );
      updateAccordionMatch("hitchcocks", Boolean(matchedKey));
      if (matchedKey) finishFirstToolsMeasure();
    });

    void oldEnglishPromise.then((data) => {
      if (!data || !isCurrentRequest()) return;
      const matchedKey = resolveOldEnglishKey(data, rawWord);
      setSelectedOldEnglishEntry(
        matchedKey
          ? { key: matchedKey, definitions: data[matchedKey] ?? [] }
          : null,
      );
      if (matchedKey) {
        updateAccordionMatch("kjv-words-phrases", true);
        finishFirstToolsMeasure();
      }
    });

    void phrasesPromise.then((data) => {
      if (!data || !isCurrentRequest()) return;
      const selection =
        tokenIndex !== null && verseNumber !== null
          ? resolvePhraseSelectionAtLocation(
              books,
              data,
              bookIndex,
              chapterIndex,
              verseNumber,
              tokenIndex,
            )
          : null;
      setSelectedPhrasesEntry(selection);
      if (selection) {
        updateAccordionMatch("kjv-words-phrases", true);
        finishFirstToolsMeasure();
      }
    });

    void unitsPromise.then((data) => {
      if (!data || !isCurrentRequest()) return;
      const matchedKey = resolveUnitsKey(data, rawWord);
      setSelectedUnitsEntry(
        matchedKey ? { key: matchedKey, entry: data[matchedKey] } : null,
      );
      if (matchedKey) {
        updateAccordionMatch("kjv-words-phrases", true);
        finishFirstToolsMeasure();
      }
    });

    void Promise.all([genealogyPromise, ancientMapsPromise]).then(([people, maps]) => {
      if (!isCurrentRequest()) return;
      const referenceKey = verseNumber !== null
        ? chapterVerseKey(bookIndex, chapterIndex, verseNumber) : null;
      const tokens = verseNumber !== null
        ? books[bookIndex]?.chapters[chapterIndex]?.verses.find(verse => verse.verse === verseNumber)?.tokens : null;
      const context = resolvePersonPlaceContext(rawWord, referenceKey, normalizedStrongCodes, tokens, tokenIndex);
      const personMatches = findGenealogyMatches(people, rawWord, referenceKey, context, { verseTokens: tokens, tokenIndex });
      const mapMatches = findMapMatches(maps, rawWord, context, personMatches);
      const supportedMaps = mapMatches.filter(entry => !entry.selectionNote);
      const ambiguous = personMatches.length > 0 && (context.ambiguous || (!context.sense && supportedMaps.length > 0));
      setPersonPlaceNotice(referenceKey && ambiguous ? AMBIGUOUS_PERSON_PLACE_NOTICE : null);
      setSelectedGenealogyIds(personMatches.map(person => person.id));
      setSelectedMapsEntries(mapMatches);
      updateAccordionMatch("genealogy", personMatches.length > 0);
      updateAccordionMatch("maps", supportedMaps.length > 0);
      if (personMatches.length || supportedMaps.length) finishFirstToolsMeasure();
    });

    if (normalizedStrongCodes.length > 0 && strongsPromise) {
      void strongsPromise.then((data) => {
        if (!data || !isCurrentRequest()) return;
        const entries = resolveStrongsEntries(
          normalizedStrongCodes,
          data.greek,
          data.hebrew,
        );
        setSelectedStrongsEntries(entries);
        updateAccordionMatch("strongs", entries.length > 0);
        if (entries.length > 0) finishFirstToolsMeasure();
      });
    }

    void Promise.all([
      concordancePromise,
      primaryToolDataPromise,
      genealogyPromise,
    ]).finally(() => {
      finishConcordanceMeasure();
      finishFirstToolsMeasure();
      finishAllToolsMeasure();
      if (normalizedStrongCodes.length > 0 && isCurrentRequest()) {
        setIsStrongsLoading(false);
      }
    });
    return selectionTarget ?? undefined;
  }

  return { openWordInStudyTools, personPlaceNotice };
}
