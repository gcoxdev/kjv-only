import type { TimelineViewState } from "@/lib/timeline-view-state";
import type { Book, VerseToken } from "@/types/bible";

export type ReaderPayload = {
  books?: Book[];
};

export type ConcordancePayload = {
  verses: string[];
  words: Record<string, number[]>;
};
export type CrossRefsPayload = Record<string, string[]>;
export type HitchcocksPayload = Record<string, string>;
export type OldEnglishPayload = Record<string, string[]>;
export type BibleWordBookEntry = {
  partOfSpeech?: string | null;
  partOfSpeechLabel?: string | null;
  meaning: string;
  body: string;
  aliases?: string[];
  sourceReferences?: string[];
};
export type BibleWordBookPayload = Record<string, BibleWordBookEntry>;
export type PhraseEntry = {
  meaning: string;
  note?: string;
  aliases?: string[];
  references?: string[];
};
export type PhrasesPayload = Record<string, PhraseEntry>;
export type UnitsEntry = {
  category: "length" | "weight" | "volume" | "currency" | "time";
  summary: string;
  approximate: string;
  aliases?: string[];
  note?: string;
  references?: string[];
};
export type UnitsPayload = Record<string, UnitsEntry>;
export type AIDictionaryEntry = {
  partOfSpeech?: string;
  classification?: string;
  definitions: string[];
  aliases?: string[];
  relatedEntries?: string[];
  note?: string;
  confidence?: "high" | "medium" | "low";
};
export type AIDictionaryPayload = Record<string, AIDictionaryEntry>;

export type GenealogyVerseByName = {
  name: string;
  verses: string[];
  numOccurrences?: number;
  numVerses?: number;
};

export type GenealogyRelation = {
  name: string;
  id: string;
  verse?: string;
};

export type GenealogyParentRef = {
  name: string;
  id: string;
};

export type GenealogyPerson = {
  id: string;
  names: string[];
  gender?: string;
  verses?: {
    byName?: GenealogyVerseByName[];
    totalOccurrences?: number;
    totalVerses?: number;
    first?: string;
  };
  father?: GenealogyParentRef;
  mother?: GenealogyParentRef;
  spouses?: GenealogyRelation[];
  siblings?: GenealogyRelation[];
  children?: GenealogyRelation[];
};

export type GenealogyPayload = GenealogyPerson[];

export type GenealogyCompactPayload = {
  x?: string;
  n?: Record<string, string>;
  u?: string[];
  v: string[];
  w: string[];
  p: Array<
    [
      string,
      number[],
      string?,
      [
        Array<[number, number[], number?, number?]>,
        number?,
        number?,
        number?,
      ]?,
      string?,
      string?,
      Array<[string, number?]>?,
      Array<[string, number?]>?,
      Array<[string, number?]>?,
    ]
  >;
};

export type WebstersEntry = {
  pronunciation?: string;
  definitions: Array<{
    type: string;
    text: string;
  }>;
};

export type WebstersPayload = Record<string, WebstersEntry>;

export type StrongsEntry = {
  kjv_def?: string;
  strongs_def?: string;
  lemma?: string;
  translit?: string;
  derivation?: string;
  pron?: string;
  kjv_refs?: Record<string, string[]>;
};

export type StrongsPayload = Record<string, StrongsEntry>;

export type StrongsCompactPayload = {
  v: string[];
  w: string[];
  s: string[];
  e: Record<
    string,
    [number?, number?, number?, number?, number?, number?, Array<[number, number[]]>?]
  >;
};

export type SearchMode =
  | "smart"
  | "contains-any"
  | "contains-all"
  | "regex";

export type SearchResultSort = "relevance" | "canonical";

export type SearchDefinition = {
  searchMode: SearchMode;
  caseSensitive: boolean;
  phraseInput: string;
  selectedWords: string[];
  selectedBookIndexes: number[];
  resultSort: SearchResultSort;
  showResultContext: boolean;
};

export type SearchMatch = {
  bookIndex: number;
  chapterIndex: number;
  verseNumber: number;
  bookName: string;
  text: string;
};

export type SearchFacets = {
  total: number;
  oldTestament: number;
  newTestament: number;
  books: Array<{
    bookIndex: number;
    bookName: string;
    count: number;
  }>;
};

export type SearchPageState = {
  searchMode: SearchMode;
  caseSensitive: boolean;
  chipInput: string;
  phraseInput: string;
  lastSearchMode: SearchMode | null;
  lastSearchCaseSensitive: boolean;
  lastSearchPhraseInput: string;
  lastSearchSelectedWords: string[];
  isControlsCollapsed: boolean;
  selectedWords: string[];
  expandedBookTree: string[];
  selectedBookIndexes: number[];
  resultSort: SearchResultSort;
  showResultContext: boolean;
  resultFacets: SearchFacets | null;
  currentPage: number;
  results: SearchMatch[];
  error: string | null;
};

export type ReaderColorTheme =
  | "brown"
  | "contrast"
  | "slate"
  | "crimson"
  | "amber"
  | "forest"
  | "navy"
  | "indigo"
  | "violet";

export type StaticPageId =
  | "settings"
  | "progress"
  | "welcome-home"
  | "saved"
  | "kjv-only"
  | "resources"
  | "churches"
  | "download"
  | "donate"
  | "credits"
  | "contact"
  | "help";

export type PanelHomeDestination = Exclude<LeafNode["view"], "reader" | "picker" | "page" | "visual-tool"> | "progress";
export type StudyWorkspaceTab = "home" | PanelHomeDestination;
export type StudyWorkspaceTool =
  | "summary"
  | "cross-refs"
  | "concordance"
  | "topics"
  | "websters"
  | "ai-dictionary"
  | "strongs"
  | "kjv-words-phrases"
  | "bible-word-book"
  | "maps"
  | "timeline"
  | "genealogy"
  | "hitchcocks";
export type StudyToolsDestination =
  | { type: "sidebar" }
  | { type: "panel"; leafId: string };
export type StudyToolsSelectionCommand =
  | {
      id: number;
      type: "verse";
      bookIndex: number;
      chapterIndex: number;
      verseNumber: number;
    }
  | {
      id: number;
      type: "word";
      rawWord: string;
      bookIndex: number;
      chapterIndex: number;
      verseNumber: number | null;
      tokenIndex: number | null;
      strongCodes: string[];
      sourceLeafId: string | null;
    };
export type WordVerseSelectionTarget =
  | "sidebar"
  | "new-tab"
  | "new-panel"
  | "targeted-panel";
export type NotesLinkOpenTarget = "new-tab" | "new-panel" | "targeted-panel";
export type SearchResultOpenTarget =
  | "new-tab"
  | "new-panel"
  | "targeted-panel";
export type BookmarkOpenTarget = "new-tab" | "new-panel" | "targeted-panel";
export type ReferenceLinkOpenTarget =
  | "new-tab"
  | "new-panel"
  | "targeted-panel";

export type ReaderNavigationTarget =
  | { type: "chapter"; bookIndex: number; chapterIndex: number }
  | {
      type: "verse";
      bookIndex: number;
      chapterIndex: number;
      verseNumber: number;
    }
  | {
      type: "selection";
      bookIndex: number;
      chapterIndex: number;
      ranges: Array<{ start: number; end: number }>;
    }
  | {
      type: "range";
      start: {
        bookIndex: number;
        chapterIndex: number;
        verseNumber: number;
      };
      end: {
        bookIndex: number;
        chapterIndex: number;
        verseNumber: number;
      };
    };

export type PendingReaderScrollTarget = {
  leafId: string;
  bookIndex: number;
  chapterIndex: number;
  mode: "chapter-top" | "verse-range";
  verseStart: number;
  verseEnd: number;
};

export type PanelDirection = "left" | "right" | "up" | "down";
export type SplitOrientation = "horizontal" | "vertical";
export type TabsOrientation = "horizontal" | "vertical";
export type IconVariant = "bw" | "color";
export type ToolReferenceDisplayMode = "buttons" | "table";

export type VisualToolOpenTarget = "dialog" | "new-panel" | "new-tab" | "targeted-panel";

export type VisualToolRequest = (
  | { kind: "genealogy"; personId: string }
  | { kind: "maps"; geojsonFile: string }
  | { kind: "timeline"; context: { bookIndex: number; chapterIndex: number } | null }
) & { requestId?: string; viewState?: TimelineViewState };

export type LeafNode = {
  id: string;
  type: "leaf";
  view:
    | "reader"
    | "picker"
    | "search"
    | "notes"
    | "topics"
    | "page"
    | "tools"
    | "bookmarks"
    | "visual-tool";
  bookIndex: number;
  chapterIndex: number;
  pickerTestament: "old" | "new" | null;
  pickerBookIndex: number | null;
  pageId: StaticPageId | null;
  visualTool?: VisualToolRequest;
};

export type SplitNode = {
  id: string;
  type: "split";
  orientation: SplitOrientation;
  ratio: number;
  first: PanelNode;
  second: PanelNode;
};

export type PanelNode = LeafNode | SplitNode;

export type ReaderTab = {
  id: string;
  title: string;
  root: PanelNode;
};

export type TokenPopupState = {
  token: VerseToken;
  x: number;
  y: number;
};
