import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Book } from "@/types/bible";
import type { ToolReferenceDisplayMode } from "@/types/reader";

export type ReferencePreviewRenderer = (
  reference: string,
  highlightWord: string,
  options?: { includeContext?: boolean; citationActions?: ReactNode; contextId?: string },
) => ReactNode;
export type ToolReferenceActions = {
  renderPreview: ReferencePreviewRenderer;
  onOpenReference: (reference: string) => void;
  onCloseSidebar: () => void;
};
const ToolReferenceContext = createContext<{
  mode: ToolReferenceDisplayMode;
  books: Book[];
  actions: ToolReferenceActions | null;
}>({ mode: "buttons", books: [], actions: null });

export function ToolReferenceDisplayModeProvider({ mode, books, renderPreview, onOpenReference, onCloseSidebar, children }: ToolReferenceActions & { mode: ToolReferenceDisplayMode; books: Book[]; children: ReactNode }) {
  const value = useMemo(() => ({ mode, books, actions: { renderPreview, onOpenReference, onCloseSidebar } }), [mode, books, renderPreview, onOpenReference, onCloseSidebar]);
  return <ToolReferenceContext.Provider value={value}>{children}</ToolReferenceContext.Provider>;
}

// The shared context also supplies Quiz with the reader's navigation and passage renderer.
export function useToolReferenceContext() { return useContext(ToolReferenceContext); }
