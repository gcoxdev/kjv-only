import { useMemo, useState } from "react";
import { CheckIcon, MapPinnedIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { mapConfidenceLabel, mapIdentificationTarget, type AncientMapEntry, type MapGeoJsonPayload } from "@/lib/maps";
import type { MapViewRequest } from "@/lib/map-view";

export function MapProposedLocations({ entry, geojson, selectedId, disabled, onSelect }: {
  entry: AncientMapEntry;
  geojson: MapGeoJsonPayload | null;
  selectedId?: string;
  disabled: boolean;
  onSelect: (target: MapViewRequest["target"], identificationId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => (entry.identifications ?? []).map(identification => ({
    ...identification,
    target: geojson ? mapIdentificationTarget(identification, geojson) : null,
  })), [entry, geojson]);
  if (candidates.length < 2) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}
        aria-label={`Proposed locations (${candidates.length})`}>
        <MapPinnedIcon data-icon="inline-start" /> Locations ({candidates.length})
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[min(24rem,60dvh)] w-80 max-w-[calc(100vw-2rem)] overflow-hidden">
        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto overscroll-contain">
        <PopoverHeader>
          <PopoverTitle>Multiple proposed locations</PopoverTitle>
          <PopoverDescription>Select a site to focus the map. Confidence is an estimate.</PopoverDescription>
        </PopoverHeader>
        <Button variant="outline" size="sm" disabled={disabled || !geojson} onClick={() => {
          onSelect(null);
          setOpen(false);
        }}>Show all locations</Button>
        <ul className="flex flex-col gap-1" aria-label="Proposed locations">
          {candidates.map(candidate => (
            <li key={candidate.id}>
              <Button variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                aria-current={selectedId === candidate.id ? "location" : undefined}
                disabled={disabled || !candidate.target}
                onClick={() => {
                  if (!candidate.target) return;
                  onSelect(candidate.target, candidate.id);
                  setOpen(false);
                }}>
                {selectedId === candidate.id ? <CheckIcon data-icon="inline-start" /> : null}
                <span className="min-w-0 flex-1">{candidate.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  <span className="sr-only">Confidence: </span>
                  {mapConfidenceLabel(candidate.confidence)}
                </span>
              </Button>
              {!candidate.target && !disabled ? <p className="px-2 text-xs text-muted-foreground">Location unavailable in this map data.</p> : null}
            </li>
          ))}
        </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
