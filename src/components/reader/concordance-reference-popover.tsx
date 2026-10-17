import { memo, type ReactNode, useEffect, useRef, useState } from "react";
import { ExternalLinkIcon, ListTreeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOptionalSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type ConcordanceReferencePopoverProps = {
  reference: string;
  label?: string;
  highlightWord: string;
  renderPreview: (
    reference: string,
    highlightWord: string,
    options?: { includeContext?: boolean },
  ) => ReactNode;
  onOpenReference: (reference: string) => void;
  onCloseSidebar: () => void;
};

type PopoverSide =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "inline-start"
  | "inline-end";
type PopoverAlign = "start" | "center" | "end";

export const ConcordanceReferencePopover = memo(function ConcordanceReferencePopover({
  reference,
  label,
  highlightWord,
  renderPreview,
  onOpenReference,
  onCloseSidebar,
}: ConcordanceReferencePopoverProps) {
  const sidebar = useOptionalSidebar();
  const [isTouchPopoverOpen, setIsTouchPopoverOpen] = useState(false);
  const [isHoverPopoverOpen, setIsHoverPopoverOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [lockedSide, setLockedSide] = useState<PopoverSide | null>(null);
  const [lockedAlign, setLockedAlign] = useState<PopoverAlign | null>(null);
  const [contextPopoverHeight, setContextPopoverHeight] = useState<number | null>(null);
  const [supportsHover, setSupportsHover] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  });
  const closeTimerRef = useRef<number | null>(null);
  const layoutGuardTimerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setSupportsHover(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => {
      mediaQuery.removeEventListener("change", update);
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (layoutGuardTimerRef.current !== null) {
        window.clearTimeout(layoutGuardTimerRef.current);
      }
    };
  }, []);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const clearLayoutGuard = () => {
    if (layoutGuardTimerRef.current !== null) {
      window.clearTimeout(layoutGuardTimerRef.current);
      layoutGuardTimerRef.current = null;
    }
  };

  const isPopoverOpen = supportsHover
    ? isHoverPopoverOpen || isKeyboardOpen
    : isTouchPopoverOpen;

  const isWithinPopover = (target: EventTarget | null) => {
    if (!(target instanceof Node)) {
      return false;
    }
    return (
      triggerRef.current?.contains(target) === true ||
      contentRef.current?.contains(target) === true
    );
  };

  const scheduleClose = (nextTarget?: EventTarget | null) => {
    if (!supportsHover) {
      return;
    }
    if (isWithinPopover(nextTarget ?? null)) {
      cancelScheduledClose();
      return;
    }
    if (layoutGuardTimerRef.current !== null) {
      cancelScheduledClose();
      return;
    }
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      setIsHoverPopoverOpen(false);
      setIsKeyboardOpen(false);
      setLockedSide(null);
      setLockedAlign(null);
      setContextPopoverHeight(null);
      closeTimerRef.current = null;
    }, 120);
  };

  const openReference = () => {
    clearLayoutGuard();
    onOpenReference(reference);
    if (!supportsHover) {
      sidebar?.setOpenMobile(false);
      onCloseSidebar();
    }
    setIsTouchPopoverOpen(false);
    setIsHoverPopoverOpen(false);
    setIsKeyboardOpen(false);
    setLockedSide(null);
    setLockedAlign(null);
    setContextPopoverHeight(null);
  };

  const toggleContext = () => {
    cancelScheduledClose();
    if (!showContext) {
      const renderedSide = contentRef.current?.dataset.side;
      const renderedAlign = contentRef.current?.dataset.align;
      if (
        renderedSide === "top" ||
        renderedSide === "bottom" ||
        renderedSide === "left" ||
        renderedSide === "right" ||
        renderedSide === "inline-start" ||
        renderedSide === "inline-end"
      ) {
        setLockedSide(renderedSide);
      }
      if (
        renderedAlign === "start" ||
        renderedAlign === "center" ||
        renderedAlign === "end"
      ) {
        setLockedAlign(renderedAlign);
      }
      setContextPopoverHeight(contentRef.current?.getBoundingClientRect().height ?? null);
    } else {
      setContextPopoverHeight(null);
    }
    if (supportsHover) {
      setIsHoverPopoverOpen(true);
      setIsKeyboardOpen(true);
      if (layoutGuardTimerRef.current !== null) {
        window.clearTimeout(layoutGuardTimerRef.current);
      }
      layoutGuardTimerRef.current = window.setTimeout(() => {
        layoutGuardTimerRef.current = null;
      }, 400);
    }
    setShowContext((current) => !current);
  };

  return (
    <Popover
      open={isPopoverOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          clearLayoutGuard();
          setLockedSide(null);
          setLockedAlign(null);
          setContextPopoverHeight(null);
        }
        if (supportsHover) {
          if (!nextOpen) {
            setIsHoverPopoverOpen(false);
            setIsKeyboardOpen(false);
          }
          return;
        }
        setIsTouchPopoverOpen(nextOpen);
      }}
    >
      <PopoverTrigger
        render={
          <button
            ref={triggerRef}
            type="button"
            className={cn(
              "inline-flex items-center rounded-md border border-border px-1.5 py-px text-xs font-medium text-foreground transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            )}
            onMouseEnter={() => {
              if (!supportsHover) {
                return;
              }
              cancelScheduledClose();
              setIsHoverPopoverOpen(true);
            }}
            onMouseLeave={(event) => {
              scheduleClose(event.relatedTarget);
            }}
            onFocus={(event) => {
              cancelScheduledClose();
              if (!supportsHover || event.currentTarget.matches(":focus-visible")) {
                setIsKeyboardOpen(true);
              }
            }}
            onBlur={(event) => {
              if (!isWithinPopover(event.relatedTarget)) {
                setIsKeyboardOpen(false);
              }
            }}
            onClick={() => {
              if (supportsHover) {
                openReference();
                return;
              }
              setIsTouchPopoverOpen(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={isPopoverOpen}
          />
        }
      >
        {label ?? reference}
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        side={lockedSide ?? "top"}
        align={lockedAlign ?? "start"}
        collisionAvoidance={
          lockedSide
            ? { side: "none", align: "none", fallbackAxisSide: "none" }
            : undefined
        }
        style={contextPopoverHeight ? { height: contextPopoverHeight } : undefined}
        className="w-80 max-w-[calc(100vw-2rem)] flex flex-col gap-2"
        onMouseEnter={() => {
          cancelScheduledClose();
          if (supportsHover) {
            setIsHoverPopoverOpen(true);
          }
        }}
        onMouseLeave={(event) => {
          scheduleClose(event.relatedTarget);
        }}
      >
        <div className="min-h-0 flex-1 max-h-[min(24rem,60vh)] overflow-y-auto pr-1 text-xs leading-relaxed">
          {renderPreview(reference, highlightWord, {
            includeContext: showContext,
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={openReference}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            Open
          </Button>
          <Button
            type="button"
            size="xs"
            variant={showContext ? "secondary" : "outline"}
            aria-pressed={showContext}
            onClick={toggleContext}
          >
            <ListTreeIcon data-icon="inline-start" />
            Context
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});
