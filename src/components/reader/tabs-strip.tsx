import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BlendIcon,
  BookMarkedIcon,
  BookOpenIcon,
  BookTextIcon,
  EllipsisVerticalIcon,
  GraduationCapIcon,
  HouseIcon,
  HistoryIcon,
  MapIcon,
  NetworkIcon,
  NotebookPenIcon,
  PencilLineIcon,
  PlusIcon,
  SearchIcon,
  ToolboxIcon,
  XIcon,
} from "lucide-react";

import { getStaticPage } from "@/lib/static-pages";
import { cn } from "@/lib/utils";
import type { ReaderTab, TabsOrientation } from "@/types/reader";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type TabsStripProps = {
  tabs: ReaderTab[];
  activeTabId: string | null;
  tabsOrientation: TabsOrientation;
  tabEndRef: RefObject<HTMLDivElement | null>;
  onActivateTab: (tabId: string) => void;
  onOpenRenameDialog: (tabId: string) => void;
  onMoveTab: (tabId: string, direction: -1 | 1) => void;
  onReorderTab: (tabId: string, targetTabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
};

function collectLeafStates(tab: ReaderTab) {
  const leaves: Array<
    ReaderTab["root"] extends infer Root
      ? Root extends { type: "leaf" }
        ? Root
        : never
      : never
  > = [];

  const visit = (node: ReaderTab["root"]) => {
    if (node.type === "leaf") {
      leaves.push(node);
      return;
    }
    visit(node.first);
    visit(node.second);
  };

  visit(tab.root);
  return leaves;
}

function getTabIcon(tab: ReaderTab) {
  const leaves = collectLeafStates(tab);
  if (leaves.length === 0) {
    return null;
  }

  const firstLeaf = leaves[0];
  const allSameView = leaves.every((leaf) => leaf.view === firstLeaf.view);
  if (!allSameView) {
    return BlendIcon;
  }

  if (firstLeaf.view === "visual-tool") {
    const kind = firstLeaf.visualTool?.kind;
    if (!leaves.every(leaf => leaf.visualTool?.kind === kind)) return BlendIcon;
    return kind === "genealogy" ? NetworkIcon : kind === "maps" ? MapIcon : HistoryIcon;
  }
  if (firstLeaf.view === "picker") {
    return HouseIcon;
  }
  if (firstLeaf.view === "tools") {
    return ToolboxIcon;
  }
  if (firstLeaf.view === "topics") {
    return BookTextIcon;
  }
  if (firstLeaf.view === "notes") {
    return NotebookPenIcon;
  }
  if (firstLeaf.view === "bookmarks") {
    return BookMarkedIcon;
  }
  if (firstLeaf.view === "quiz") return GraduationCapIcon;
  if (firstLeaf.view === "search") {
    return SearchIcon;
  }
  if (firstLeaf.view === "page") {
    const samePageId = leaves.every((leaf) => leaf.pageId === firstLeaf.pageId);
    return samePageId
      ? (getStaticPage(firstLeaf.pageId)?.icon ?? BookOpenIcon)
      : BookOpenIcon;
  }
  if (firstLeaf.view === "reader") {
    return BookOpenIcon;
  }

  return null;
}

export function TabsStrip({
  tabs,
  activeTabId,
  tabsOrientation,
  tabEndRef,
  onActivateTab,
  onOpenRenameDialog,
  onMoveTab,
  onReorderTab,
  onCloseTab,
  onAddTab,
}: TabsStripProps) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropTargetTabId, setDropTargetTabId] = useState<string | null>(null);
  const [touchMoveTabId, setTouchMoveTabId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressTapRef = useRef(false);
  const touchPointerRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const touchSourceTabIdRef = useRef<string | null>(null);

  const clearAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const scrollViewportByEdge = () => {
    if (!touchMoveTabId) {
      clearAutoScroll();
      return;
    }

    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    const pointer = touchPointerRef.current;
    if (!viewport || !pointer) {
      clearAutoScroll();
      return;
    }

    const startPointer = touchStartPointerRef.current;
    if (!startPointer) {
      clearAutoScroll();
      return;
    }

    const deadZone = 8;
    const maxDistance = 120;
    const maxScrollStep = 20;
    const edgeThreshold = 72;
    let deltaX = 0;
    let deltaY = 0;
    const rect = viewport.getBoundingClientRect();

    if (tabsOrientation === "horizontal") {
      const distance = pointer.x - startPointer.x;
      const magnitude = Math.abs(distance);
      if (magnitude > deadZone) {
        const normalized = Math.min((magnitude - deadZone) / maxDistance, 1);
        const step = Math.max(2, Math.round(normalized * maxScrollStep));
        deltaX = distance < 0 ? -step : step;
      }

      const leftEdgeDistance = pointer.x - rect.left;
      const rightEdgeDistance = rect.right - pointer.x;
      if (leftEdgeDistance >= 0 && leftEdgeDistance < edgeThreshold) {
        const normalized = 1 - leftEdgeDistance / edgeThreshold;
        deltaX = Math.min(deltaX, -Math.max(2, Math.round(normalized * maxScrollStep)));
      } else if (rightEdgeDistance >= 0 && rightEdgeDistance < edgeThreshold) {
        const normalized = 1 - rightEdgeDistance / edgeThreshold;
        deltaX = Math.max(deltaX, Math.max(2, Math.round(normalized * maxScrollStep)));
      }
    } else {
      const distance = pointer.y - startPointer.y;
      const magnitude = Math.abs(distance);
      if (magnitude > deadZone) {
        const normalized = Math.min((magnitude - deadZone) / maxDistance, 1);
        const step = Math.max(2, Math.round(normalized * maxScrollStep));
        deltaY = distance < 0 ? -step : step;
      }

      const topEdgeDistance = pointer.y - rect.top;
      const bottomEdgeDistance = rect.bottom - pointer.y;
      if (topEdgeDistance >= 0 && topEdgeDistance < edgeThreshold) {
        const normalized = 1 - topEdgeDistance / edgeThreshold;
        deltaY = Math.min(deltaY, -Math.max(2, Math.round(normalized * maxScrollStep)));
      } else if (bottomEdgeDistance >= 0 && bottomEdgeDistance < edgeThreshold) {
        const normalized = 1 - bottomEdgeDistance / edgeThreshold;
        deltaY = Math.max(deltaY, Math.max(2, Math.round(normalized * maxScrollStep)));
      }
    }

    if (deltaX !== 0 || deltaY !== 0) {
      viewport.scrollBy({ left: deltaX, top: deltaY });
      autoScrollFrameRef.current = window.requestAnimationFrame(scrollViewportByEdge);
      return;
    }

    clearAutoScroll();
  };

  useEffect(() => clearAutoScroll, []);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, tabId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tabId);
    setDraggedTabId(tabId);
    setDropTargetTabId(tabId);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>, tabId: string) => {
    event.preventDefault();
    if (draggedTabId && draggedTabId !== tabId) {
      setDropTargetTabId(tabId);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, tabId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (draggedTabId && draggedTabId !== tabId) {
      setDropTargetTabId(tabId);
    }
  };

  const clearDragState = () => {
    setDraggedTabId(null);
    setDropTargetTabId(null);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const clearTouchMoveState = () => {
    setTouchMoveTabId(null);
    touchSourceTabIdRef.current = null;
    touchPointerRef.current = null;
    touchStartPointerRef.current = null;
    suppressTapRef.current = false;
    clearLongPressTimer();
    clearAutoScroll();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetTabId: string) => {
    event.preventDefault();
    const sourceTabId = event.dataTransfer.getData("text/plain") || draggedTabId;
    if (sourceTabId && sourceTabId !== targetTabId) {
      onReorderTab(sourceTabId, targetTabId);
    }
    clearDragState();
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLDivElement>,
    tabId: string,
  ) => {
    if (event.pointerType !== "touch") {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    clearLongPressTimer();
    touchSourceTabIdRef.current = tabId;
    touchPointerRef.current = { x: event.clientX, y: event.clientY };
    touchStartPointerRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      setTouchMoveTabId(tabId);
      setDropTargetTabId(tabId);
      suppressTapRef.current = true;
      scrollViewportByEdge();
    }, 450);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }
    clearLongPressTimer();
    if (!touchMoveTabId) {
      return;
    }

    const sourceTabId = touchSourceTabIdRef.current;
    const targetTabId = dropTargetTabId;
    if (sourceTabId && targetTabId && sourceTabId !== targetTabId) {
      onReorderTab(sourceTabId, targetTabId);
    }
    clearTouchMoveState();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    touchPointerRef.current = { x: event.clientX, y: event.clientY };

    if (!touchMoveTabId) {
      const startPointer = touchStartPointerRef.current;
      if (startPointer) {
        const deltaX = Math.abs(event.clientX - startPointer.x);
        const deltaY = Math.abs(event.clientY - startPointer.y);
        if (deltaX > 8 || deltaY > 8) {
          clearLongPressTimer();
        }
      }
      return;
    }

    event.preventDefault();

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-tab-id]");
    const targetTabId = target?.dataset.tabId ?? null;

    if (targetTabId && targetTabId !== dropTargetTabId) {
      setDropTargetTabId(targetTabId);
    }

    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(scrollViewportByEdge);
    }
  };

  const handleTabActivate = (tabId: string) => {
    if (touchMoveTabId) {
      return;
    }

    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }

    onActivateTab(tabId);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (tabsOrientation !== "horizontal") {
      return;
    }

    const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    if (!viewport) {
      return;
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (delta === 0) {
      return;
    }

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    if (maxScrollLeft <= 0) {
      return;
    }

    const clampedDelta = Math.max(
      -viewport.scrollLeft,
      Math.min(delta, maxScrollLeft - viewport.scrollLeft),
    );
    if (clampedDelta === 0) {
      return;
    }

    event.preventDefault();
    viewport.scrollBy({ left: clampedDelta, behavior: "smooth" });
  };

  return (
    <ScrollArea
      ref={scrollAreaRef}
      className="h-full w-full"
      data-tour="tabs-strip"
      onWheel={handleWheel}
    >
      <div
        className={cn(
          touchMoveTabId && "touch-none select-none",
          tabsOrientation === "vertical"
            ? "flex flex-col items-stretch gap-2 p-2.5"
            : "flex w-max items-center gap-2 p-2",
        )}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={clearTouchMoveState}
      >
        {tabs.map((tab, index) => {
          const active = tab.id === activeTabId;
          const TabIcon = getTabIcon(tab);
          const canMoveLeft = tabs.length > 1 && index > 0;
          const canMoveRight = tabs.length > 1 && index < tabs.length - 1;
          const moveBackwardLabel =
            tabsOrientation === "vertical" ? "Move Up" : "Move Left";
          const moveForwardLabel =
            tabsOrientation === "vertical" ? "Move Down" : "Move Right";
          const MoveBackwardIcon =
            tabsOrientation === "vertical" ? ArrowUpIcon : ArrowLeftIcon;
          const MoveForwardIcon =
            tabsOrientation === "vertical" ? ArrowDownIcon : ArrowRightIcon;
          return (
            <div
              key={tab.id}
              draggable
              data-tab-id={tab.id}
              onDragStart={(event) => handleDragStart(event, tab.id)}
              onDragEnter={(event) => handleDragEnter(event, tab.id)}
              onDragOver={(event) => handleDragOver(event, tab.id)}
              onDragEnd={clearDragState}
              onDrop={(event) => handleDrop(event, tab.id)}
              onPointerDown={(event) => handlePointerDown(event, tab.id)}
              className={cn(
                "rounded-lg transition-opacity",
                draggedTabId === tab.id && "opacity-60",
                (dropTargetTabId === tab.id && draggedTabId !== tab.id) ||
                  (touchMoveTabId === tab.id &&
                    "ring-2 ring-primary/35 ring-offset-2 ring-offset-background"),
                ((dropTargetTabId === tab.id && draggedTabId !== tab.id) ||
                  touchMoveTabId === tab.id) &&
                  "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
                tabsOrientation === "vertical" && "w-full",
              )}
            >
              <ButtonGroup
                className={cn(tabsOrientation === "vertical" && "w-full")}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTabActivate(tab.id)}
                  className={cn(
                    "min-w-28 justify-start border-subtle-divider/80 bg-workspace-panel-elevated text-left shadow-none",
                    tabsOrientation === "vertical" &&
                      "h-auto w-full min-w-0 flex-1 whitespace-normal wrap-break-word py-1.5 text-left leading-tight",
                    active &&
                      "border-primary! bg-primary/92! text-primary-foreground! hover:bg-primary/90! hover:text-primary-foreground!",
                  )}
                >
                  {TabIcon ? <TabIcon className="size-4 shrink-0" /> : null}
                  <span className="min-w-0 truncate">{tab.title}</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        data-tour={active ? "tab-options" : undefined}
                        className={cn(
                          "relative border-subtle-divider/80 bg-workspace-panel-elevated",
                          tabsOrientation === "vertical" && "h-auto self-stretch",
                          active &&
                            "border-primary! bg-primary/92! text-primary-foreground! hover:bg-primary/90! hover:text-primary-foreground! before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-primary-foreground/35 before:content-['']",
                        )}
                        aria-label={`Tab options for ${tab.title}`}
                      >
                        <EllipsisVerticalIcon />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => onOpenRenameDialog(tab.id)}>
                        <PencilLineIcon />
                        Relabel Tab
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    {tabs.length > 1 ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          {canMoveLeft ? (
                            <DropdownMenuItem onClick={() => onMoveTab(tab.id, -1)}>
                              <MoveBackwardIcon />
                              {moveBackwardLabel}
                            </DropdownMenuItem>
                          ) : null}
                          {canMoveRight ? (
                            <DropdownMenuItem onClick={() => onMoveTab(tab.id, 1)}>
                              <MoveForwardIcon />
                              {moveForwardLabel}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => onCloseTab(tab.id)}>
                            <XIcon />
                            Close Tab
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </ButtonGroup>
            </div>
          );
        })}

        <Button
          variant="outline"
          size="icon-sm"
          onClick={onAddTab}
          data-tour="add-tab"
          aria-label="New Tab"
          className={cn(
            "border-dashed border-subtle-divider/80 bg-workspace-panel/70",
            tabsOrientation === "vertical" && "w-full",
          )}
        >
          <PlusIcon />
        </Button>
        <div ref={tabEndRef} />
      </div>
      <ScrollBar
        orientation={tabsOrientation === "vertical" ? "vertical" : "horizontal"}
      />
    </ScrollArea>
  );
}
