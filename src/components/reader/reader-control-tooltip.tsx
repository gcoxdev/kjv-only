import type { ReactElement } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ReaderControlTooltip({
  children,
  label,
  side = "top",
  disabled = false,
}: {
  children: ReactElement;
  label: string;
  side?: "top" | "bottom";
  disabled?: boolean;
}) {
  // Let Base UI coordinate hover, focus, and pointer travel into the popup.
  // Closing on pointerleave here creates a loop when the opening animation
  // briefly crosses the edge of the trigger.
  // Distinct keys reattach its native hover listeners when the disabled
  // wrapper is replaced by the enabled button (or vice versa).
  return (
    <Tooltip>
      {disabled ? (
        <TooltipTrigger
          key="disabled"
          delay={0}
          render={<span className="inline-flex" />}
        >
          {children}
        </TooltipTrigger>
      ) : (
        <TooltipTrigger key="enabled" delay={0} render={children} />
      )}
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
