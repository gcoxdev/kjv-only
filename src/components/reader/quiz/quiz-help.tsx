import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardAction } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export function QuizHelp({ title, children }: { title: string; children: ReactNode }) {
  return <CardAction><Popover>
    <PopoverTrigger openOnHover delay={250} render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`About ${title.toLowerCase()}`}><InfoIcon /></Button>} />
    <PopoverContent align="end" className="max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
      <PopoverTitle>{title}</PopoverTitle>
      <div className="flex flex-col gap-2">{children}</div>
    </PopoverContent>
  </Popover></CardAction>;
}
