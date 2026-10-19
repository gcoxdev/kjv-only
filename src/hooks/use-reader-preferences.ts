import { useEffect, useMemo, useRef, type SetStateAction } from "react";
import { useSyncedStorage } from "@/hooks/use-synced-storage";
import { READER_STORAGE_KEYS, reportLocalStorageIssue } from "@/lib/local-storage";
import { isReaderDisplaySettingsPayload, parseReaderDisplaySettings, type ReaderDisplaySettings } from "@/lib/reader-persistence";
import { mergeStoredFields } from "@/lib/synced-storage";
import type { TabsOrientation } from "@/types/reader";

type UseReaderPreferencesOptions = { tabsOrientation: TabsOrientation; setTabsOrientation: (orientation: TabsOrientation) => void };

export function useReaderPreferences({ tabsOrientation, setTabsOrientation }: UseReaderPreferencesOptions) {
  const [settings, updateSettings] = useSyncedStorage(READER_STORAGE_KEYS.displaySettings, {
    parse(raw) {
      const value: unknown = raw === null ? null : JSON.parse(raw);
      if (value !== null && !isReaderDisplaySettingsPayload(value)) reportLocalStorageIssue(READER_STORAGE_KEYS.displaySettings);
      return parseReaderDisplaySettings(value);
    },
    stringify: JSON.stringify,
  }, mergeStoredFields<ReaderDisplaySettings>, parseReaderDisplaySettings(null));
  const [theme, setTheme] = useSyncedStorage<"light" | "dark">(READER_STORAGE_KEYS.theme, {
    parse: raw => raw === "dark" || raw === "light" ? raw : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    stringify: value => value,
  }, (_latest, _before, after) => after, "light");
  const lastOrientation = useRef(tabsOrientation);
  useEffect(() => {
    if (settings.tabsOrientation && settings.tabsOrientation !== lastOrientation.current) {
      lastOrientation.current = settings.tabsOrientation;
      setTabsOrientation(settings.tabsOrientation);
    } else if (tabsOrientation !== lastOrientation.current) {
      lastOrientation.current = tabsOrientation;
      updateSettings(current => ({ ...current, tabsOrientation }));
    }
  }, [settings.tabsOrientation, tabsOrientation, setTabsOrientation, updateSettings]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.readerTheme = settings.readerColorTheme;
  }, [settings.readerColorTheme]);
  const setters = useMemo(() => {
    const setter = <K extends keyof ReaderDisplaySettings>(key: K) => (action: SetStateAction<ReaderDisplaySettings[K]>) => {
      updateSettings(current => ({ ...current, [key]: typeof action === "function" ? action(current[key]) : action }));
    };
    return {
      setReaderColorTheme: setter("readerColorTheme"),
      setFontSize: setter("fontSize"),
      setLightHighlightColor: setter("lightHighlightColor"),
      setDarkHighlightColor: setter("darkHighlightColor"),
      setVerseSpacing: setter("verseSpacing"),
      setContextVerseCount: setter("contextVerseCount"),
      setToolReferenceDisplayMode: setter("toolReferenceDisplayMode"),
      setHideReadModeVerseNumbers: setter("hideReadModeVerseNumbers"),
      setReadModeParagraphIndent: setter("readModeParagraphIndent"),
      setFlowVersesByParagraph: setter("flowVersesByParagraph"),
      setShowWelcomeHomeAtStartup: setter("showWelcomeHomeAtStartup"),
      setWordVerseSelectionTarget: setter("wordVerseSelectionTarget"),
      setNotesLinkOpenTarget: setter("notesLinkOpenTarget"),
      setSearchResultOpenTarget: setter("searchResultOpenTarget"),
      setBookmarkOpenTarget: setter("bookmarkOpenTarget"),
      setReferenceLinkOpenTarget: setter("referenceLinkOpenTarget"),
      setGenealogyOpenTarget: setter("genealogyOpenTarget"),
      setMapsOpenTarget: setter("mapsOpenTarget"),
      setTimelineOpenTarget: setter("timelineOpenTarget"),
    };
  }, [updateSettings]);
  return { ...settings, ...setters, theme, setTheme };
}
