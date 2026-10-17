import type { ComponentProps } from "react";

import { SummaryTool } from "@/components/reader/study-tools/summary-tool";
import { CrossRefsTool } from "@/components/reader/study-tools/cross-refs-tool";
import { ConcordanceTool } from "@/components/reader/study-tools/concordance-tool";
import { WebstersTool } from "@/components/reader/study-tools/websters-tool";
import { AIDictionaryTool } from "@/components/reader/study-tools/ai-dictionary-tool";
import { StrongsTool } from "@/components/reader/study-tools/strongs-tool";
import { KJVWordsPhrasesTool } from "@/components/reader/study-tools/kjv-words-phrases-tool";
import { BibleWordBookTool } from "@/components/reader/study-tools/bible-word-book-tool";
import { TimelineTool } from "@/components/reader/study-tools/timeline-tool";
import { MapsTool } from "@/components/reader/study-tools/maps-tool";
import { GenealogyTool } from "@/components/reader/study-tools/genealogy-tool";
import { HitchcocksTool } from "@/components/reader/study-tools/hitchcocks-tool";

export type ReaderStudyToolsContentProps = {
  summaryProps: ComponentProps<typeof SummaryTool>;
  crossRefsProps: ComponentProps<typeof CrossRefsTool>;
  concordanceProps: ComponentProps<typeof ConcordanceTool>;
  webstersProps: ComponentProps<typeof WebstersTool>;
  aiDictionaryProps: ComponentProps<typeof AIDictionaryTool>;
  strongsProps: ComponentProps<typeof StrongsTool>;
  kjvWordsPhrasesProps: ComponentProps<typeof KJVWordsPhrasesTool>;
  bibleWordBookProps: ComponentProps<typeof BibleWordBookTool>;
  timelineProps: ComponentProps<typeof TimelineTool>;
  mapsProps: ComponentProps<typeof MapsTool>;
  genealogyProps: ComponentProps<typeof GenealogyTool>;
  hitchcocksProps: ComponentProps<typeof HitchcocksTool>;
};

type ReaderStudyToolsContentComponentProps = ReaderStudyToolsContentProps & {
  openSections?: readonly string[];
};

export function ReaderStudyToolsContent({
  summaryProps,
  crossRefsProps,
  concordanceProps,
  webstersProps,
  aiDictionaryProps,
  strongsProps,
  kjvWordsPhrasesProps,
  bibleWordBookProps,
  mapsProps,
  timelineProps,
  genealogyProps,
  hitchcocksProps,
  openSections,
}: ReaderStudyToolsContentComponentProps) {
  const isSectionOpen = (section: string, fallback: boolean) =>
    openSections ? openSections.includes(section) : fallback;

  return (
    <>
      <SummaryTool
        {...summaryProps}
        isOpen={isSectionOpen("summary", summaryProps.isOpen)}
      />
      <CrossRefsTool
        {...crossRefsProps}
        isOpen={isSectionOpen("cross-refs", crossRefsProps.isOpen)}
      />
      <ConcordanceTool
        {...concordanceProps}
        isOpen={isSectionOpen("concordance", concordanceProps.isOpen)}
      />
      <WebstersTool
        {...webstersProps}
        isOpen={isSectionOpen("websters", webstersProps.isOpen)}
      />
      <StrongsTool
        {...strongsProps}
        isOpen={isSectionOpen("strongs", strongsProps.isOpen)}
      />
      <KJVWordsPhrasesTool
        {...kjvWordsPhrasesProps}
        isOpen={isSectionOpen(
          "kjv-words-phrases",
          kjvWordsPhrasesProps.isOpen,
        )}
      />
      <BibleWordBookTool
        {...bibleWordBookProps}
        isOpen={isSectionOpen(
          "bible-word-book",
          bibleWordBookProps.isOpen,
        )}
      />
      <HitchcocksTool
        {...hitchcocksProps}
        isOpen={isSectionOpen("hitchcocks", hitchcocksProps.isOpen)}
      />
      <AIDictionaryTool
        {...aiDictionaryProps}
        isOpen={isSectionOpen(
          "ai-dictionary",
          aiDictionaryProps.isOpen,
        )}
      />
      <GenealogyTool
        {...genealogyProps}
        isOpen={isSectionOpen("genealogy", genealogyProps.isOpen)}
      />
      <MapsTool
        {...mapsProps}
        isOpen={isSectionOpen("maps", mapsProps.isOpen)}
      />
      <TimelineTool {...timelineProps} isOpen={isSectionOpen("timeline", timelineProps.isOpen)} />
    </>
  );
}
