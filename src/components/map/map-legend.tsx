"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccountStatusCounts } from "./map-utils";

export interface MapLegendProps {
  counts: AccountStatusCounts;
  className?: string;
}

export function MapLegend({ counts, className }: MapLegendProps) {
  return (
    <div
      data-map-control="true"
      aria-label="Legenda de status das contas"
      className={cn(
        "pointer-events-auto absolute bottom-3 left-3 z-[410] sm:bottom-4 sm:left-4",
        className,
      )}
    >
      <Card className="gap-1.5 px-3 py-2 text-xs shadow-lg">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">
            <span data-numeric>{counts.total}</span>{" "}
            {counts.total === 1 ? "conta" : "contas"}
          </span>

          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden className="status-dot" />
            <span>
              Ativas:{" "}
              <strong data-numeric className="font-semibold text-foreground">
                {counts.active}
              </strong>
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span
              aria-hidden
              className="inline-block size-2 shrink-0 rounded-full bg-destructive"
            />
            <span>
              Reconexão:{" "}
              <strong data-numeric className="font-semibold text-foreground">
                {counts.needs_reauth}
              </strong>
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden className="status-dot-muted" />
            <span>
              Inativas:{" "}
              <strong data-numeric className="font-semibold text-foreground">
                {counts.inactive}
              </strong>
            </span>
          </span>
        </div>
      </Card>
    </div>
  );
}
