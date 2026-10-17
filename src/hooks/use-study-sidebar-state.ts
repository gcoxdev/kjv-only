export const STUDY_ACCORDION_ITEMS = [
  "summary",
  "cross-refs",
  "concordance",
  "websters",
  "strongs",
  "kjv-words-phrases",
  "bible-word-book",
  "hitchcocks",
  "ai-dictionary",
  "genealogy",
  "maps",
  "timeline",
] as const;

type UseStudySidebarStateArgs = {
  accordionValue: string[];
  crossRefsCount: number;
  concordanceCount: number;
  webstersCount: number;
  aiDictionaryCount: number;
  strongsCount: number;
  bibleWordBookCount: number;
  mapsCount: number;
  hitchcocksCount: number;
  kjvWordsPhrasesCount: number;
  genealogyCount: number;
};

export function useStudySidebarState({
  accordionValue,
  crossRefsCount,
  concordanceCount,
  webstersCount,
  aiDictionaryCount,
  strongsCount,
  bibleWordBookCount,
  mapsCount,
  hitchcocksCount,
  kjvWordsPhrasesCount,
  genealogyCount,
}: UseStudySidebarStateArgs) {
  const normalizedAccordionValue = accordionValue.map((item) =>
    item === "old-english" || item === "phrases" || item === "units"
      ? "kjv-words-phrases"
      : item,
  );
  const allStudyAccordionsOpen = STUDY_ACCORDION_ITEMS.every((item) =>
    normalizedAccordionValue.includes(item),
  );
  const openStudySections = new Set(normalizedAccordionValue);

  return {
    allStudyAccordionsOpen,
    isCrossRefsSectionOpen: openStudySections.has("cross-refs"),
    isConcordanceSectionOpen: openStudySections.has("concordance"),
    isWebstersSectionOpen: openStudySections.has("websters"),
    isAIDictionarySectionOpen: openStudySections.has("ai-dictionary"),
    isStrongsSectionOpen: openStudySections.has("strongs"),
    isBibleWordBookSectionOpen: openStudySections.has("bible-word-book"),
    isKjvWordsPhrasesSectionOpen: openStudySections.has("kjv-words-phrases"),
    isMapsSectionOpen: openStudySections.has("maps"),
    isGenealogySectionOpen: openStudySections.has("genealogy"),
    isHitchcocksSectionOpen: openStudySections.has("hitchcocks"),
    hasCrossRefsInfo: crossRefsCount > 0,
    hasConcordanceInfo: concordanceCount > 0,
    hasWebstersInfo: webstersCount > 0,
    hasAIDictionaryInfo: aiDictionaryCount > 0,
    hasStrongsInfo: strongsCount > 0,
    hasBibleWordBookInfo: bibleWordBookCount > 0,
    hasKjvWordsPhrasesInfo: kjvWordsPhrasesCount > 0,
    hasMapsInfo: mapsCount > 0,
    hasHitchcocksInfo: hitchcocksCount > 0,
    hasGenealogyInfo: genealogyCount > 0,
  };
}

export const deriveStudySidebarState = useStudySidebarState;
