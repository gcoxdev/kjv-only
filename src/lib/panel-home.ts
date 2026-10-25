import { GraduationCapIcon, BookMarkedIcon, BookTextIcon, ChartBarIcon, NotebookPenIcon, SearchIcon, ToolboxIcon } from "lucide-react";
import type { PanelHomeDestination } from "@/types/reader";

// Both panel Home and sidebar Home use this list and the same navigation contract.
export const PANEL_HOME_DESTINATIONS = {
  tools: { title: "Tools", icon: ToolboxIcon },
  topics: { title: "Topics", icon: BookTextIcon },
  notes: { title: "Notes", icon: NotebookPenIcon },
  bookmarks: { title: "Bookmarks", icon: BookMarkedIcon },
  search: { title: "Search", icon: SearchIcon },
  quiz: { title: "Quiz", icon: GraduationCapIcon },
  progress: { title: "Reading Progress", icon: ChartBarIcon },
} satisfies Record<PanelHomeDestination, { title: string; icon: typeof ToolboxIcon }>;
