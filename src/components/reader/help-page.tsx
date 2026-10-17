import { useDeferredValue, useMemo, useState } from "react";
import {
  BadgeHelpIcon,
  BookOpenIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileSearchIcon,
  HistoryIcon,
  LayoutPanelTopIcon,
  MessageSquareMoreIcon,
  MonitorSmartphoneIcon,
  SearchIcon,
  Settings2Icon,
  Share2Icon,
  SidebarIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type HelpItem = {
  label: string;
  body: string;
  keywords?: string[];
};

type HelpSection = {
  id: string;
  title: string;
  icon: typeof BadgeHelpIcon;
  summary: string;
  keywords: string[];
  items: HelpItem[];
};

const HELP_SECTIONS: HelpSection[] = [
  {
    id: "overview",
    title: "What This App Is For",
    icon: BookOpenIcon,
    summary:
      "This page is the main reference for using the application efficiently. It explains study tools, panel behavior, search modes, common workflows, and the rest of the current feature set.",
    keywords: ["overview", "purpose", "guide", "reference", "start", "usage"],
    items: [
      {
        label: "What KJV Only is",
        body:
          "KJV Only is a Scripture-first workspace built around the King James Bible. It combines reading, searching, study tools, notes, bookmarks, cross references, dictionaries, genealogy, maps, timelines, and audio inside one application.",
        keywords: ["what is this", "what does this app do", "purpose"],
      },
      {
        label: "How to start using the app",
        body:
          "On a fresh open, the app creates a Genesis 1 reader tab and, by default, an active Welcome Home tab. Start reading, open Search or Quick Open, or take the guided tour. You can turn the startup Welcome Home tab off under Settings > Other.",
        keywords: ["start", "getting started", "first open", "welcome"],
      },
      {
        label: "How this help page should be used",
        body:
          "Use the search box to find tasks, features, or workflows. This page should be updated whenever the application changes so it stays trustworthy and current.",
        keywords: ["search help", "documentation", "manual"],
      },
    ],
  },
  {
    id: "common-tasks",
    title: "Common Tasks",
    icon: BadgeHelpIcon,
    summary:
      "This section is meant for quick 'how do I do this?' searches. Each item is brief and action-focused.",
    keywords: ["how to", "common tasks", "quick help", "instructions"],
    items: [
      {
        label: "How to open one or more Bible references quickly",
        body:
          "Use the compass button in the top bar to open Quick Open. Type a reference such as John 3:16, or separate several references with semicolons, then choose whether to open them in new tabs, a new panel, or panels in one tab.",
        keywords: ["quick open", "open references", "compass", "multiple passages", "reference command"],
      },
      {
        label: "How to add a new tab",
        body:
          "Use the add-tab button in the tab strip. This creates a new tab with its own panel workspace, separate from the current tab.",
        keywords: ["new tab", "plus button", "add tab", "create tab"],
      },
      {
        label: "How to rename a tab",
        body:
          "Open the active tab's options menu in the tab strip, then choose the relabel action and enter the new title.",
        keywords: ["relabel tab", "rename tab", "tab options"],
      },
      {
        label: "How to use or change keyboard shortcuts",
        body:
          "Open Settings > Shortcuts to see every available action and its current binding. Click a binding to replace it with one key combination or a sequence of up to three steps. You can clear an action, restore one default, or restore all defaults; press ? outside a text field to open the shortcut list directly.",
        keywords: ["keyboard shortcuts", "hotkeys", "key bindings", "remap", "chords", "defaults"],
      },
      {
        label: "How to reorder tabs",
        body:
          "Drag a tab to a new position with a mouse, use Move Left or Move Right from its options menu, or long-press and drag it on a touch screen. With vertical tabs, the menu actions become Move Up and Move Down.",
        keywords: ["reorder tabs", "drag tab", "move tab", "long press"],
      },
      {
        label: "How to split a panel",
        body:
          "Open the panel options menu, then choose Split Left, Right, Up, or Down. This creates a second panel inside the same tab so you can compare content side by side.",
        keywords: ["split panel", "new panel", "side by side"],
      },
      {
        label: "How to move a panel",
        body:
          "Open the panel options menu and use Move Left, Right, Up, or Down to rearrange the current layout. The same menu can move a panel into an existing tab or into a new tab, while keeping its content and panel-local state together.",
        keywords: ["move panel", "rearrange panel", "move to tab", "new tab"],
      },
      {
        label: "How to return a panel to panel home",
        body:
          "Use the panel-home action from the panel header or panel options. If the panel came from a current Bible context, panel home preserves the current testament or book context when appropriate.",
        keywords: ["panel home", "go home", "picker"],
      },
      {
        label: "How to open search",
        body:
          "Use the top-bar search action or the Open Search shortcut from Welcome Home. Search opens inside the current workspace so results can be sent into tabs or panels.",
        keywords: ["open search", "search page"],
      },
      {
        label: "How to enable dark mode",
        body:
          "Open Main Menu, then Settings, then the Visual tab. Turn on the Dark Mode switch there. Light mode is the default unless you explicitly save dark mode.",
        keywords: ["dark mode", "theme", "light mode"],
      },
      {
        label: "How to change the color theme",
        body:
          "Open Main Menu, then Settings, then the Visual tab. Use the Color Theme setting to switch among the available palettes such as Brown, Contrast, Slate, Forest, Navy, and others.",
        keywords: ["theme color", "color theme", "contrast"],
      },
      {
        label: "How to change font size or line spacing",
        body:
          "Open Main Menu, then Settings, then the Visual tab. Use the Font Size controls and the Line Spacing setting to adjust reading comfort.",
        keywords: ["font size", "line spacing", "reader appearance"],
      },
      {
        label: "How to make results open in the same panel",
        body:
          "Choose Targeted Panel in the relevant targeting setting, then mark a panel as the targeted panel from that panel's options. Future opens of that type will reuse that destination.",
        keywords: ["targeted panel", "same panel", "reuse panel"],
      },
      {
        label: "How to install the app",
        body:
          "Open the Download page and use Install App if your browser exposes that option. On some browsers, especially mobile browsers, installation may also be available from the browser menu.",
        keywords: ["install app", "pwa", "add to home screen"],
      },
      {
        label: "How to download content for offline use",
        body:
          "While online, open Download and cache the bundle you need: Core Bible Data, Maps, Old Testament Audio, or New Testament Audio. Core includes the production app shell, Bible and study data, and book icons. Installing the app does not automatically download these optional offline bundles.",
        keywords: ["offline", "download bundle", "cache"],
      },
      {
        label: "How to apply an app update",
        body:
          "When a complete new version is ready, a notice appears with Details, Later, and Update Now. Later keeps the current version running. Update Now activates the cached version and reloads every open KJV Only tab once so all tabs use matching files.",
        keywords: ["app update", "update now", "later", "new version", "reload tabs"],
      },
      {
        label: "How to repair the offline app cache",
        body:
          "While online, open Download > App Updates and Recovery, export notes and bookmarks if needed, then choose Repair App Cache. Repair removes only KJV Only's service worker and app-owned caches, reloads the app, and requires offline bundles to be downloaded again.",
        keywords: ["repair app cache", "recovery", "service worker", "offline error", "reset cache"],
      },
      {
        label: "How to export notes or bookmarks",
        body:
          "Open the main menu and choose Export Notes or Export Bookmarks. A JSON file will be downloaded so you can back up or transfer your data.",
        keywords: ["export notes", "export bookmarks", "backup"],
      },
      {
        label: "How to import notes or bookmarks",
        body:
          "Open the main menu and choose Import Notes or Import Bookmarks, then select the saved JSON file. The app merges imported entries by id and shows an import summary afterward.",
        keywords: ["import notes", "import bookmarks", "restore"],
      },
      {
        label: "How to start the guided tour",
        body:
          "Open Welcome Home and select Take the Tour. The tour explains the main menu, search, sharing, tabs, sidebar, reader panel, panel options, and panel bottom bar.",
        keywords: ["tour", "guided tour", "take the tour"],
      },
    ],
  },
  {
    id: "workspace",
    title: "Tabs, Panels, and Navigation",
    icon: LayoutPanelTopIcon,
    summary:
      "The workspace is built from tabs and panels. Tabs divide larger study sessions, and panels let you compare content side by side inside a tab.",
    keywords: ["tabs", "panels", "layout", "move", "split", "home", "picker", "navigation"],
    items: [
      {
        label: "What tabs are for",
        body:
          "Use tabs to separate larger study sessions. A tab can hold one panel or a full split layout, and each tab keeps its own panel arrangement.",
        keywords: ["tabs", "workspace"],
      },
      {
        label: "What panel home is for",
        body:
          "Panel Home is the launch point for a panel. From there you can choose a Bible book and chapter or open Tools, Topics, Notes, Bookmarks, or Search. Informational pages such as Help and Download are opened from the main menu or Welcome Home.",
        keywords: ["panel home", "picker", "launch panel"],
      },
      {
        label: "How to tell which panel is active",
        body:
          "The active panel uses the same accent-colored header treatment as the active tab. Click or focus anything in a panel to make it active, or use Alt plus an arrow key to move to the neighboring panel in that direction. These directional shortcuts can be changed under Settings > Shortcuts.",
        keywords: ["active panel", "panel focus", "alt arrow", "keyboard navigation", "panel header"],
      },
      {
        label: "How panel history works",
        body:
          "Each panel keeps its own back and forward history. That history covers reader navigation and panel-home destinations inside that panel, not the whole tab at once.",
        keywords: ["back", "forward", "history"],
      },
      {
        label: "How advanced panel layouts work",
        body:
          "Panel options can rotate the parent split, insert a panel beside the current panel within its group, or add a panel around the whole group. Hovering an available layout action previews where the panel will go before you select it.",
        keywords: ["rotate split", "insert in group", "add around group", "layout preview", "advanced panels"],
      },
      {
        label: "What the targeted panel is for",
        body:
          "A targeted panel is a reusable destination for references, note links, bookmarks, search results, and word or verse actions. It is useful when you want one panel to act like a dedicated lookup area.",
        keywords: ["targeted panel", "destination panel"],
      },
      {
        label: "How to close a panel",
        body:
          "Use the panel options menu and choose the close action. If the tab has only one panel, the app returns that panel to panel home instead of leaving the tab empty.",
        keywords: ["close panel", "remove panel"],
      },
      {
        label: "How to use fullscreen for a panel",
        body:
          "Use the panel options menu to enter fullscreen when you want one panel to fill the screen temporarily. Exiting fullscreen returns you to the normal layout.",
        keywords: ["fullscreen", "maximize panel"],
      },
      {
        label: "What a shared layout includes",
        body:
          "A layout link preserves tab names and order, panel structure and destinations, tab orientation, the targeted panel, verse highlight ranges, and each Search panel's query, mode, book scope, case setting, sort, and context setting. Genealogy, Maps, and Timeline panels also restore their supported context and view state. Search result lists are not placed in the URL; run the restored search to rebuild them.",
        keywords: ["shared layout", "url", "search in url", "layout link", "search criteria"],
      },
    ],
  },
  {
    id: "reader",
    title: "Reader Basics",
    icon: MonitorSmartphoneIcon,
    summary:
      "The reader is where chapter text is displayed and where most direct study actions begin.",
    keywords: ["reader", "chapter", "word", "verse", "selection", "audio", "progress", "bottom bar"],
    items: [
      {
        label: "How to open a book and chapter",
        body:
          "Use Continue on Panel Home to open your next unread chapter, or choose any location with the panel home picker or the reader's book and chapter control. Existing reader panels preserve current context better than a brand-new panel does.",
        keywords: ["open chapter", "continue reading", "panel home", "book picker", "chapter picker"],
      },
      {
        label: "How to study a word",
        body:
          "Switch to Study mode, then click a word in the text or focus it and press Enter or Space. The selection can update cross references, concordance, Strong's, dictionaries, genealogy, maps, and other tools according to the data available for that token.",
        keywords: ["click word", "word study", "strongs", "concordance"],
      },
      {
        label: "How to study a verse",
        body:
          "In Study mode, click a verse to select its verse-based context. This is useful for cross references, notes, bookmarks, and verse-linked navigation. In Highlight mode, verse clicks instead build the highlighted selection.",
        keywords: ["click verse", "verse context"],
      },
      {
        label: "How to use highlight mode",
        body:
          "Open a reader panel's options and turn Highlight Mode on, then use the verse checkboxes to select verses or ranges. From the same menu you can bookmark the highlighted selection or clear its highlights. Layout links preserve the selected ranges.",
        keywords: ["highlight mode", "verse checkbox", "select verses"],
      },
      {
        label: "How to use chapter audio",
        body:
          "Use Show Audio in the panel bottom bar for chapter playback. The player supports play/pause, seeking, playback speed, mute, volume, and optional automatic playback of the next chapter. Download Old or New Testament Audio from Download if you need playback offline.",
        keywords: ["audio", "play chapter", "audio player"],
      },
      {
        label: "How to mark a chapter as read",
        body:
          "Use the panel bottom bar to update chapter progress, or open Reading Progress to review and manage progress across the whole Bible.",
        keywords: ["mark read", "reading progress", "chapter progress"],
      },
      {
        label: "How to move to the next or previous chapter",
        body:
          "Use Prev and Next in the panel bottom bar. On a touch screen in Read mode, you can also swipe horizontally across the chapter; Study mode leaves horizontal gestures available for study interactions instead.",
        keywords: ["next chapter", "previous chapter", "chapter navigation", "swipe"],
      },
    ],
  },
  {
    id: "sidebar",
    title: "Study and Read Mode",
    icon: SidebarIcon,
    summary:
      "The application can emphasize reading or studying, and sidebar Home offers reading progress, tools, topics, notes, bookmarks, and search alongside the Bible.",
    keywords: ["sidebar", "study mode", "read mode", "tools", "topics", "notes", "bookmarks", "accordion"],
    items: [
      {
        label: "How to switch between read mode and study mode",
        body:
          "Use the read and study mode toggle in the top bar. Read mode keeps attention on the text, while study mode makes the sidebar workspace available.",
        keywords: ["study mode", "read mode", "toggle sidebar"],
      },
      {
        label: "How to use sidebar Home",
        body:
          "Sidebar Home has the same study options as Panel Home, without a book and chapter selector. Choose Reading Progress, Tools, Topics, Notes, Bookmarks, or Search. Use the Home button beside the title to return. Notes includes the full list and editor, so you can create and edit notes directly in the sidebar.",
        keywords: ["sidebar home", "tools", "topics", "notes", "bookmarks", "search", "reading progress"],
      },
      {
        label: "How tool accordions behave",
        body:
          "Study tools use accordion sections, with Expand All and Collapse All controls. Clicking a word or verse can automatically open relevant sections and load matching entries; tools still allow their own manual searches.",
        keywords: ["accordion", "expand tools", "collapse all", "auto open", "manual search"],
      },
    ],
  },
  {
    id: "tools",
    title: "Study Tools",
    icon: WrenchIcon,
    summary:
      "The tools workspace is centered on the current word, verse, chapter, or selection. Each tool focuses on a different kind of study help.",
    keywords: [
      "cross refs",
      "concordance",
      "websters",
      "strongs",
      "kjv words phrases",
      "ai dictionary",
      "bible word-book",
      "hitchcocks",
      "genealogy",
      "maps",
      "topics",
    ],
    items: [
      {
        label: "How to use Summary",
        body:
          "Open Tools and expand Summary at the top. Chapter follows the current reading passage; Book gives an overview, and Bible summarizes the Old and New Testaments. Choose another book or chapter to browse independently, then use Follow reader to reconnect. Scripture references offer the same previews and opening actions as other tools. All summaries are included in the Core Bible Data offline download.",
        keywords: ["summary", "summaries", "chapter overview", "book overview", "Old Testament", "New Testament"],
      },
      {
        label: "How to use Cross Refs",
        body:
          "Cross Refs are verse-based. Click a verse or a word within a verse and the app can load cross references for that verse so you can follow related passages quickly.",
        keywords: ["cross refs", "cross references"],
      },
      {
        label: "How to view and preview tool references",
        body:
          "Study-tool references appear in Bible-book, chapter, and verse order. Longer lists include Filters for including or excluding the Old Testament, New Testament, or any relevant book. Settings > Other can show references as compact preview buttons or a scrollable verse table. Table rows have independent Open and Context controls, and the context-verse setting controls how many surrounding verses both modes and Search results display.",
        keywords: ["reference preview", "popover", "table", "buttons", "filter references", "Bible order", "Old Testament", "New Testament", "books", "context", "surrounding verses", "open reference"],
      },
      {
        label: "How to use Concordance",
        body:
          "Concordance is best for tracing repeated Bible vocabulary. Clicking a word in the text or selecting a concordance result will show matching references for that term.",
        keywords: ["concordance", "word references"],
      },
      {
        label: "How to use Webster's and Bible Word-Book",
        body:
          "Use these when a word needs historical or older-English clarification. They are especially useful for KJV wording that is less common in modern speech.",
        keywords: ["websters", "bible word-book", "archaic words"],
      },
      {
        label: "How to use KJV Words & Phrases and AI Dictionary",
        body:
          "KJV Words & Phrases combines archaic-word, phrase, and biblical-unit material. AI Dictionary provides additional prepared explanations for harder KJV words. Click a word or search either tool directly when the automatic match is not the entry you need.",
        keywords: ["kjv words phrases", "old english", "archaic", "units", "ai dictionary"],
      },
      {
        label: "How to use Strong's",
        body:
          "Strong's is available when the selected token has Strong's data. Clicking a word with attached Strong's information will load the corresponding entry and references.",
        keywords: ["strongs", "greek", "hebrew"],
      },
      {
        label: "How to use Hitchcock's Bible Names",
        body:
          "Use Hitchcock's for concise name meanings. It can respond to a selected Bible name or to a name entered in the tool's own search box.",
        keywords: ["hitchcocks", "bible names", "name meaning"],
      },
      {
        label: "How to use Genealogy",
        body:
          "Click a person's name in the reader or search Genealogy, select the matching person, and choose View Tree. Family cards show birth and death information when supported; reigns and recorded activity are not treated as lifespans. Genealogy opens in a dialog by default, with panel and tab destinations available under Settings > Targeting.",
        keywords: ["genealogy", "family tree", "people"],
      },
      {
        label: "How to explore a genealogy timeline",
        body:
          "In the family viewer, choose Timeline, then Overview, Family, or Jesus' lineage. All, People, and Events control what appears. Jesus' lineage offers Joseph and Mary (Luke interpretation): Luke explicitly names Joseph, so the Mary branch is labeled as an interpretation. Estimated ancestor placements are schematic, not known birth years. Missing dates remain unknown; use the evidence and KJV passages to distinguish lifetimes from other activity.",
        keywords: ["genealogy timeline", "Adam", "Jesus", "Mary", "Joseph", "birth", "death", "lineage", "unknown dates"],
      },
      {
        label: "How to use Maps",
        body:
          "Select or search for a biblical place and open its map. Recenter returns to the opened location; Show areas or Hide areas controls the outlines. Switch between OpenFreeMap and Leaflet, and use Map style for regular or topographic views. Maps can open in a dialog, panel, or tab through Settings > Targeting. The Maps download stores the place index and geometry; background maps require a connection.",
        keywords: ["maps", "places", "geography", "openfreemap", "leaflet", "recenter", "outlines", "topographic", "map style"],
      },
      {
        label: "How the two map searches differ",
        body:
          "Search places or addresses submits an online geographic search using Photon / OpenStreetMap. Search this area finds biblical places in the current map area using the app's place index; move the map and search the area again to refresh those results. A modern search result is not automatically an identified biblical location.",
        keywords: ["map search", "address", "Photon", "Search this area", "biblical places"],
      },
      {
        label: "How to read location confidence",
        body:
          "When a biblical place has several proposed identifications, Locations lists the candidates and their available confidence scores. The map footer also shows confidence for the selected candidate, including when there is only one. If none is selected, choose a candidate to see its score. These are source confidence ratings, not measured probabilities; modern address-search results do not have biblical identification scores.",
        keywords: ["confidence", "locations", "candidate", "identification", "score"],
      },
      {
        label: "How to browse Topics",
        body:
          "Open Topics in the Study sidebar or Panel Home. Choose one or more starting letters or type in Filter Topics, then expand a topic to preview and open its Scripture references.",
        keywords: ["topics", "topic scriptures", "browse topics", "filter topics"],
      },
    ],
  },
  {
    id: "timeline",
    title: "Historical Timeline",
    icon: HistoryIcon,
    summary:
      "Explore a chapter's biblical setting alongside contemporary history, or follow the Gospel harmony and Paul's missions. Every chapter has context; some events remain undated.",
    keywords: ["timeline", "history", "chronology", "harmony", "missions"],
    items: [
      {
        label: "How to open and browse Timeline",
        body:
          "Open Tools, expand Timeline below Maps, and choose Open timeline. The view follows the reader's book and chapter until you choose another passage or Pin chapter. Follow reader reconnects it. Choose Chapter, Book, Gospel harmony, Paul’s missions, or Wider history; the narrative collections also offer stages. All, Biblical, and Historical context filter the entries, and the search field narrows them further.",
        keywords: ["open timeline", "book", "chapter", "Pin chapter", "Follow reader", "Gospel harmony", "Paul", "filter", "stages"],
      },
      {
        label: "How to read timeline dates and shapes",
        body:
          "A diamond marks a single event, a solid bar represents a duration, and a striped box is a possible date window rather than a claim that an event lasted that long. Broken ends indicate unknown endpoints; a hollow circle marks a schematic lineage placement. Undated entries stay in the list. A displayed year can still be approximate: select the entry to read its explanation, KJV passages, and supporting sources.",
        keywords: ["diamond", "stripes", "date window", "duration", "broken ends", "approximate", "undated", "legend"],
      },
      {
        label: "How to give the chart more room",
        body:
          "Choose Expand chart, then drag horizontally or use the zoom and fit controls. On a narrow mobile screen the expanded chart hides the collection filters and legend to leave more room; collapse it to change those controls. Fit includes the labels as well as the events.",
        keywords: ["expand chart", "mobile", "zoom", "fit", "pan", "labels", "full screen"],
      },
      {
        label: "How timeline sources and related tools work",
        body:
          "Select an entry to inspect its evidence and open available Maps or Genealogy connections. Their labels distinguish the event itself from book context, historical geography, or people and places mentioned in its passages. A recalled story, prophecy, or comparison does not establish participation in the selected event. Sources & method explains the provisional chronology, with the KJV as the primary source. All external citations and source links are listed on Credits. KJV passage links remain with the evidence.",
        keywords: ["sources", "method", "KJV", "evidence", "related tools", "connections", "Credits", "encyclopedia"],
      },
      {
        label: "How people and events connect across timelines",
        body:
          "Include biblical people adds relevant lifespans and activity to Historical Timeline. In Genealogy, choose Family or Jesus' lineage, then All or Events for reviewed related events. Include contextual mentions also shows entries that reference those people without establishing participation; these are labeled Contextual mention. Both tools share chronology records. Reigns and estimated lineage positions never supply unknown birth or death dates.",
        keywords: ["biblical people", "lifespans", "family events", "lineage", "contextual mentions", "reigns"],
      },
      {
        label: "How timeline views are remembered",
        body:
          "Timeline and genealogy timeline views remember their filters, selection, and chart window. Panel views travel with the panel and its shared layout URL; dialog views are remembered locally. The chronology model is shared between the viewers. Sources & method offers 430 years in Egypt or 430 years from the promise; this changes the early chronology proposal without settling every later date question.",
        keywords: ["remember", "preferences", "share timeline", "chronology model", "430 years", "Egypt", "promise"],
      },
    ],
  },
  {
    id: "search",
    title: "Search Page",
    icon: FileSearchIcon,
    summary:
      "Search supports four query modes, per-panel criteria, saved and recent searches, book scope, sorting, context, result counts, copying, and text export.",
    keywords: ["search", "smart", "exact phrase", "contains any", "contains all", "regex", "chips", "results", "book filter", "saved search", "history", "facets", "context", "export"],
    items: [
      {
        label: "How to use Smart search",
        body:
          "Smart is the best first choice for remembered fragments, misspellings, Bible names, and loose phrases. Single-word searches favor close forms of that word, while multi-word searches tolerate more variation. If a term appears misspelled, Did You Mean suggestions can replace it before you search again.",
        keywords: ["smart search", "fuzzy search", "misspelling", "did you mean", "single word"],
      },
      {
        label: "How to require an exact phrase",
        body:
          "In Smart mode, put quotation marks around the words that must appear together, such as \"loved the world\". You can combine quoted phrases with unquoted terms. Use the Case-sensitive option when capitalization must also match.",
        keywords: ["exact phrase", "quotes", "quoted search", "case sensitive"],
      },
      {
        label: "How to use Contains Any and Contains All",
        body:
          "In these modes, type into the chip input to find concordance words, add the chips you want, then run the search. Contains Any finds verses containing any chosen chip. Contains All requires all chosen chips.",
        keywords: ["contains any", "contains all", "chip search"],
      },
      {
        label: "How to use regex search",
        body:
          "Regex search is for precise patterns. Use it when you already know the pattern shape you want and need tighter matching than Smart or chip-based search can provide.",
        keywords: ["regex", "regular expression"],
      },
      {
        label: "Regex learning links",
        body:
          "Learn more: RegexOne and regular-expressions.info open external sites with beginner-friendly regex lessons and reference material.",
        keywords: ["regexone", "regular-expressions.info", "learn regex", "external links"],
      },
      {
        label: "How to limit search to certain books",
        body:
          "Open Scope and select the entire Bible, a testament, a book group, or individual books. Parent checkboxes select or clear their descendants, and the tree can be expanded only as far as you need.",
        keywords: ["book filter", "limit search", "search by book"],
      },
      {
        label: "How to save or reopen a search",
        body:
          "After entering a valid query, choose Save Search and give it a name. Saved & Recent restores the query, mode, selected books, case sensitivity, result sort, and context setting. Saved searches and the most recent completed searches stay only in this browser and are not part of notes or bookmarks exports.",
        keywords: ["save search", "saved recent", "search history", "load search", "local search"],
      },
      {
        label: "How to sort and inspect search results",
        body:
          "Sort results by Relevance or Bible order. Context adds the configured number of verses before and after each match without crossing a chapter boundary; change the amount under Settings > Other. Facets shows Old Testament, New Testament, and per-book counts for the currently loaded result set; it reports counts rather than changing the book scope.",
        keywords: ["sort results", "relevance", "bible order", "context", "facets", "result counts"],
      },
      {
        label: "How to copy or export search results",
        body:
          "Open Result Tools and choose Copy as Text or Export .txt. Both actions use all currently loaded results, not only the visible page, and include adjacent verses when Context is enabled.",
        keywords: ["copy results", "export results", "text file", "result tools"],
      },
      {
        label: "What happens during a long search",
        body:
          "The first Search open may prepare the Bible index in the background. Smart search can show useful matches while the remaining candidates are still being checked, and Stop cancels the active run. A search loads up to 500 matches and displays them 50 at a time for responsiveness.",
        keywords: ["search slow", "preparing index", "search progress", "stop search", "pagination", "50 results"],
      },
      {
        label: "How search results open",
        body:
          "Search results can open in a new tab, new panel, or targeted panel based on your targeting settings. This lets you control whether results replace the current reading flow or open beside it.",
        keywords: ["search results", "open result target"],
      },
      {
        label: "How Search panels are represented in a shared URL",
        body:
          "Each Search panel contributes its current definition to the layout URL: mode, case setting, query or chips, selected books, sort, and Context choice. The loaded verses, facets, page number, errors, saved-search library, and recent history are not encoded. A reopened link restores the controls so the search can be run again.",
        keywords: ["search url", "share search", "encoded search", "layout hash", "search state"],
      },
    ],
  },
  {
    id: "notes-bookmarks",
    title: "Notes, Bookmarks, and Internal Links",
    icon: MessageSquareMoreIcon,
    summary:
      "Notes and bookmarks are local-first study aids that can be scoped broadly or tied to a specific context.",
    keywords: ["notes", "bookmarks", "general", "context", "chapter", "verse", "word", "internal links", "import", "export"],
    items: [
      {
        label: "How to create a general note",
        body:
          "Open the Notes area and create a note without tying it to the current passage. General notes stay available regardless of the current Bible context.",
        keywords: ["general note", "new note"],
      },
      {
        label: "How to create a context note",
        body:
          "First activate the relevant chapter, verse, word, or highlighted selection in the reader, then choose New Context in Notes. Context notes can be filtered for the active location, and an existing note can be converted between General and Context or broadened to chapter scope while editing.",
        keywords: ["context note", "word note", "verse note", "chapter note"],
      },
      {
        label: "How to edit and format notes",
        body:
          "Select a note, choose Edit, and use the rich-text toolbar for formatting. The note editor can hide its tools, fill the screen, or show the stored source for advanced troubleshooting. Save commits the draft; Cancel restores the last saved version.",
        keywords: ["edit note", "rich text", "note toolbar", "fullscreen editor", "note source"],
      },
      {
        label: "How to create a bookmark",
        body:
          "Create bookmarks for chapters, verses, selections, or ranges. Bookmarks are useful for reading plans, sermon studies, repeated references, and places you want to revisit later.",
        keywords: ["new bookmark", "selection bookmark"],
      },
      {
        label: "How to organize notes and bookmarks",
        body:
          "While editing, choose or create one folder and add multiple tags separated by commas. The folder and tag filters narrow the list. Unfiled includes items with no folder, and Untagged includes items with no tags, including older notes and bookmarks. Clear a folder or remove tags to return an item to those groups.",
        keywords: ["folders", "tags", "Unfiled", "Untagged", "organize", "old notes", "old bookmarks"],
      },
      {
        label: "How to change a bookmark's destination",
        body:
          "Edit the bookmark and change Bookmark location to the Bible reference you want, then save. Bookmark label is a separate display name: renaming it does not move the bookmark. The location must be a valid reference before the change can be saved.",
        keywords: ["edit bookmark", "Bookmark label", "Bookmark location", "destination", "rename"],
      },
      {
        label: "How internal note links work",
        body:
          "While editing a note, typed Bible references such as John 3:16 are recognized as internal links. Those links can reopen chapters, verses, selections, ranges, and words inside the reader using the destination selected under Settings > Targeting.",
        keywords: ["internal links", "note links", "kjv://", "automatic bible links", "typed reference"],
      },
      {
        label: "How import and export work",
        body:
          "Notes and bookmarks can be exported and imported from the main menu. Imports merge by id, preserve current formats, and show an import summary with imported, replaced, and skipped counts.",
        keywords: ["import", "export", "backup", "transfer"],
      },
      {
        label: "Where notes and bookmarks are stored",
        body:
          "They are stored locally in this browser on this device. They are not automatically synced, so exporting periodically is the safest way to keep a portable backup.",
        keywords: ["local storage", "browser storage", "backup"],
      },
    ],
  },
  {
    id: "settings",
    title: "Settings and Targeting",
    icon: Settings2Icon,
    summary:
      "Settings are divided into Visual, Targeting, Shortcuts, and Other tabs so appearance, opening behavior, keyboard controls, and startup behavior can be controlled separately.",
    keywords: ["settings", "visual", "targeting", "shortcuts", "other", "theme", "dark mode", "font", "line spacing", "reference target", "welcome home"],
    items: [
      {
        label: "How to open Settings",
        body:
          "Open the main menu, then choose Settings. Settings open as a page in their own tab so you can change preferences without interrupting your current reading layout.",
        keywords: ["open settings", "settings page"],
      },
      {
        label: "What the Visual tab controls",
        body:
          "The Visual tab contains dark mode, color theme, font size, line spacing, highlight colors, verse-number visibility, paragraph flow, and tab orientation settings.",
        keywords: ["visual tab", "appearance"],
      },
      {
        label: "What the Targeting tab controls",
        body:
          "The Targeting tab controls where actions open. Word and verse selection, note links, search results, bookmarks, and reference links can each use their own destination behavior. Genealogy, Maps, and Timeline each have a separate setting for Dialog, New Panel, New Tab, or Targeted Panel. A targeted panel is marked from its panel options menu.",
        keywords: ["targeting tab", "open target", "new tab", "new panel", "targeted panel"],
      },
      {
        label: "What the Shortcuts tab controls",
        body:
          "The Shortcuts tab lists configurable general, tab, panel, layout, and reader-panel actions. Defaults include Ctrl or Command combinations, Alt plus an arrow key to focus a neighboring panel, and sequential chords such as T then N. Plain-key shortcuts pause briefly for the next step and do not run while you type in a field or note editor; Save active note remains available in the active note editor.",
        keywords: ["shortcuts tab", "keyboard", "ctrl", "command", "chord", "save note", "customize shortcuts"],
      },
      {
        label: "What the Other tab controls",
        body:
          "The Other tab controls whether tool references use preview buttons or a verse table, how many surrounding verses Search Context and tool references show, and whether Welcome Home opens as the active tab when the app starts without a shared layout. Genesis 1 remains available as the reader tab either way.",
        keywords: ["other tab", "reference display", "reference table", "reference buttons", "context verses", "surrounding verses", "welcome home startup", "startup tab", "genesis"],
      },
      {
        label: "How to change highlight colors",
        body:
          "Open Settings, then Visual, then set Light Highlight Color and Dark Highlight Color separately if needed. This helps keep selections readable in both modes.",
        keywords: ["highlight color", "light highlight", "dark highlight"],
      },
      {
        label: "How to manage Reading Progress",
        body:
          "Open Reading Progress from the main menu, Welcome Home, or Panel Home to view completion for the whole Bible, each testament, book, and chapter. The Up Next card shows where to continue and opens the next unread chapter after the chapter you most recently marked. You can also open any chapter in a new tab, toggle one chapter, mark a whole book or testament complete or incomplete, or reset all progress after confirmation.",
        keywords: ["reading progress", "continue reading", "panel home", "complete book", "complete testament", "reset progress", "open chapter"],
      },
    ],
  },
  {
    id: "sharing-offline",
    title: "Sharing, Install, and Offline Use",
    icon: Share2Icon,
    summary:
      "The app supports shareable layouts, browser installation, explicit offline bundles, controlled updates, and app-specific cache recovery.",
    keywords: ["share", "layout", "install", "pwa", "offline", "download", "update", "recovery", "service worker", "refresh bundle", "clear bundle"],
    items: [
      {
        label: "How to share a layout",
        body:
          "Choose Share Current Layout in the main menu to copy the current layout URL to the clipboard. The link can be reopened later or sent to someone else so the same tabs, panels, locations, and supported panel state can be reconstructed.",
        keywords: ["share layout", "share link"],
      },
      {
        label: "How to install the app",
        body:
          "Use Download > Install App when the browser exposes an install prompt. If it says Prompt unavailable, use the browser menu's Install app or Add to Home screen action when available. Installation is optional and is separate from downloading offline content.",
        keywords: ["install app", "pwa", "browser install"],
      },
      {
        label: "How app updates work",
        body:
          "An update is offered only after the new production shell has been cached completely. Choosing Later leaves the active session alone; choosing Update Now activates the waiting version and reloads all open KJV Only tabs once. Download > App Updates and Recovery can also check manually and show active, configured, and waiting cache versions.",
        keywords: ["app update", "update notice", "waiting version", "cache version", "check for updates"],
      },
      {
        label: "How to tell whether a download is complete and current",
        body:
          "Each bundle reports Not downloaded, Partially cached, or Fully cached, together with file and size information. Fully cached describes file availability, not whether the content is the latest version. Read the freshness message separately: Up to date, Update available, Download incomplete, Matches last known version, or Freshness unknown. Last verified download records a completed download check, not every app launch. Refresh Bundle downloads the bundle again; Check for Missing Files fills gaps.",
        keywords: ["download status", "Fully cached", "freshness", "Update available", "Last verified download", "missing files"],
      },
      {
        label: "How to refresh or clear offline bundles",
        body:
          "On the Download page, Refresh Bundle re-downloads a bundle, Check for Missing Files fills only gaps, and Clear Bundle removes that specific resource group to free storage.",
        keywords: ["refresh bundle", "clear bundle", "missing files"],
      },
      {
        label: "How to tell what is available offline",
        body:
          "The Download page shows bundle status, cached file counts, sizes, and storage estimates so you can see what has been downloaded and what still needs to be cached.",
        keywords: ["offline status", "cached files", "storage"],
      },
      {
        label: "How to test offline mode",
        body:
          "Use a deployed build or run npm run build followed by npm run preview, open the app online, and fully download Core Bible Data before switching the browser network to Offline and reloading. The npm run dev server intentionally disables the service worker, so it cannot verify offline startup.",
        keywords: ["test offline", "localhost", "preview", "development server", "service worker disabled", "core bible data"],
      },
      {
        label: "What to do when offline content is missing",
        body:
          "Reconnect first. Use Check for Missing Files on the affected bundle to fill gaps, or Refresh Bundle to replace its cached files. If the shell itself is inconsistent after an update, use Refresh Core Files; reserve Repair App Cache for recovery after exporting local notes and bookmarks.",
        keywords: ["offline missing", "failed to fetch", "white screen", "missing files", "refresh core", "repair cache"],
      },
      {
        label: "What Repair App Cache removes",
        body:
          "Repair is available only while online. It unregisters only this app's same-origin service worker and deletes only caches whose names begin with the KJV Only cache prefix. It does not target notes or bookmarks, but it does remove downloaded Core, Maps, and Audio bundles, which must then be downloaded again.",
        keywords: ["repair cache", "what is removed", "notes safe", "bookmarks safe", "redownload bundles"],
      },
    ],
  },
  {
    id: "guided-pages",
    title: "Welcome Home, Tour, and Static Pages",
    icon: DownloadIcon,
    summary:
      "The app includes guided and informational pages alongside the main Bible workspace.",
    keywords: ["welcome home", "tour", "help", "saved", "kjv only", "download", "progress", "settings"],
    items: [
      {
        label: "What Welcome Home is for",
        body:
          "Welcome Home is the active startup tab by default on a fresh open. It gives a short orientation and quick actions for continuing at your next unread chapter, reviewing Reading Progress, taking the tour, opening Search, and managing offline downloads. Settings > Other can disable opening it at startup.",
        keywords: ["welcome home", "start page"],
      },
      {
        label: "What the guided tour covers",
        body:
          "The guided tour introduces the main menu, Quick Open, search, mode toggle, tabs, sidebar, reader panel, panel options, and the panel bottom bar.",
        keywords: ["tour", "guided tour"],
      },
      {
        label: "What the static pages are for",
        body:
          "Welcome Home, How to Get Saved, Why KJV Only?, Resources, Local Churches, Download, Donate, Credits, Contact, Help, Settings, and Reading Progress open inside the tab-and-panel workspace. Reading Progress is also available in the sidebar. Use the main menu to reach these pages.",
        keywords: ["static pages", "help page", "saved page", "kjv only page"],
      },
    ],
  },
  {
    id: "tips",
    title: "Practical Tips",
    icon: BadgeHelpIcon,
    summary:
      "A few habits make the app easier to use day to day, especially once your workspace becomes more complex.",
    keywords: ["tips", "workflow", "best practices", "common workflows", "helpful"],
    items: [
      {
        label: "Use targeted panels for repeated lookups",
        body:
          "If you want search results, references, or bookmark opens to keep landing in the same place, use the Targeted Panel setting and mark one destination panel first.",
        keywords: ["targeted panel tip"],
      },
      {
        label: "Use tabs for sessions and panels for comparison",
        body:
          "A good working habit is to separate major studies into tabs and use panels inside a tab for side-by-side comparison.",
        keywords: ["workflow tip", "tabs and panels"],
      },
      {
        label: "Export local data periodically",
        body:
          "Because notes and bookmarks are local-first, export them periodically and before browser-storage troubleshooting. The exports do not include reading progress, preferences, saved searches, recent searches, or downloaded offline bundles.",
        keywords: ["backup tip", "export"],
      },
      {
        label: "Use Help search with task phrases",
        body:
          "Search this page with a task such as repair app cache, exact phrase, move panel, saved search, Quick Open, context note, or autoplay audio. Matches are ranked by topic title, answer text, and related keywords.",
        keywords: ["search help", "task phrase", "find help", "help topics"],
      },
    ],
  },
];

function scoreText(text: string, normalizedQuery: string, queryTerms: string[]) {
  const haystack = text.toLowerCase();
  let score = 0;

  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    score += haystack.startsWith(normalizedQuery) ? 12 : 8;
  }

  for (const term of queryTerms) {
    if (!term) {
      continue;
    }
    if (haystack.startsWith(term)) {
      score += 6;
    } else if (haystack.includes(term)) {
      score += 3;
    }
  }

  return score;
}

function scoreHelpItem(
  section: HelpSection,
  item: HelpItem,
  normalizedQuery: string,
  queryTerms: string[],
) {
  if (!normalizedQuery) {
    return 1;
  }

  const labelScore = scoreText(item.label, normalizedQuery, queryTerms) * 4;
  const bodyScore = scoreText(item.body, normalizedQuery, queryTerms);
  const itemKeywordScore = (item.keywords ?? []).reduce(
    (sum, keyword) => sum + scoreText(keyword, normalizedQuery, queryTerms) * 3,
    0,
  );
  const sectionScore =
    scoreText(section.title, normalizedQuery, queryTerms) * 2 +
    section.keywords.reduce(
      (sum, keyword) => sum + scoreText(keyword, normalizedQuery, queryTerms),
      0,
    );

  return labelScore + bodyScore + itemKeywordScore + sectionScore;
}

function getVisibleHelpSections(normalizedQuery: string) {
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  const sections = HELP_SECTIONS.map((section) => {
    const scoredItems = section.items
      .map((item) => ({
        item,
        score: scoreHelpItem(section, item, normalizedQuery, queryTerms),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label));

    return {
      ...section,
      items: normalizedQuery
        ? scoredItems.map(({ item }) => item)
        : section.items,
      score: scoredItems[0]?.score ?? 0,
    };
  });

  if (!normalizedQuery) {
    return sections;
  }

  return sections
    .filter((section) => section.items.length > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}

export function HelpPage() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const visibleSections = useMemo(
    () => getVisibleHelpSections(normalizedQuery),
    [normalizedQuery],
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader>
          <CardTitle>Application Help</CardTitle>
          <CardDescription>
            This page is the main reference for using the application efficiently.
            Search by task, feature, workflow, or setting to get quick answers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-2 text-sm leading-7 text-muted-foreground">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search application help"
              placeholder="Search for a task, feature, setting, or workflow..."
              className="h-10 pl-9 pr-10"
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setQuery("")}
                aria-label="Clear help search"
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            Try searches like: Quick Open, exact phrase, saved search, move panel,
            targeted panel, autoplay audio, export notes, test offline, or repair app
            cache.
          </p>
        </CardContent>
      </Card>

      {visibleSections.length > 0 ? (
        <div className="grid gap-4">
          {visibleSections.map((section) => (
            <Card
              key={section.id}
              className="border-border/70 bg-card/70"
              id={`help-${section.id}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <section.icon className="size-4 text-muted-foreground" />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.summary}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-2">
                {section.items.map((item) => (
                  <div
                    key={`${section.id}-${item.label}`}
                    className="rounded-lg border border-border/60 bg-background/60 p-3"
                  >
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {item.body}
                    </p>
                    {item.label === "Regex learning links" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">Learn more:</span>
                        <a
                          href="https://www.regexone.com/"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                        >
                          RegexOne
                          <ExternalLinkIcon className="size-3" />
                        </a>
                        <a
                          href="https://www.regular-expressions.info/"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                        >
                          regular-expressions.info
                          <ExternalLinkIcon className="size-3" />
                        </a>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle>No matching help topics</CardTitle>
            <CardDescription>
              Try a broader task-based query such as <span className="text-foreground">add a tab</span>,
              <span className="text-foreground"> saved search</span>,
              <span className="text-foreground"> targeted panel</span>, or
              <span className="text-foreground"> test offline</span>.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
