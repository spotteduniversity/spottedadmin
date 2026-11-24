"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SpottedMapAccount } from "@/mocks/spotteds-map";
import {
  ACCOUNT_STATUS_LABEL,
  getAccountStatus,
  type AccountStatusCounts,
  type SpottedStatusFilter,
} from "./map-utils";

export interface MapFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: SpottedStatusFilter;
  onStatusFilterChange: (value: SpottedStatusFilter) => void;
  counts: AccountStatusCounts;
  matchingAccounts: SpottedMapAccount[];
  onFocusAccount: (account: SpottedMapAccount) => void;
}

const FILTER_OPTIONS: ReadonlyArray<{
  value: SpottedStatusFilter;
  label: string;
  countKey: keyof AccountStatusCounts;
}> = [
  { value: "all", label: "Todas", countKey: "total" },
  { value: "active", label: "Ativas", countKey: "active" },
  {
    value: "needs_reauth",
    label: "Reconexão necessária",
    countKey: "needs_reauth",
  },
  { value: "inactive", label: "Inativas", countKey: "inactive" },
];

export function MapFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  counts,
  matchingAccounts,
  onFocusAccount,
}: MapFiltersProps) {
  const showQuickMatches =
    search.trim().length > 0 && matchingAccounts.length > 0 && matchingAccounts.length <= 5;

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && matchingAccounts.length > 0) {
      event.preventDefault();
      onFocusAccount(matchingAccounts[0]);
    } else if (event.key === "Escape" && search.trim().length > 0) {
      event.preventDefault();
      event.stopPropagation();
      onSearchChange("");
    }
  }

  return (
    <div
      data-map-control="true"
      className="pointer-events-auto absolute top-3 right-3 left-3 z-[420] flex flex-col gap-2 sm:top-4 sm:right-auto sm:left-4 sm:w-[400px]"
    >
      <Card className="gap-2.5 p-2.5 shadow-lg">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Label htmlFor="mapa-busca" className="sr-only">
            Buscar cidade ou página do Spotted
          </Label>
          <Input
            id="mapa-busca"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar cidade, página ou @usuario…"
            className="pr-8 pl-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Filtrar contas por status"
          className="flex flex-wrap gap-1.5"
        >
          {FILTER_OPTIONS.map((option) => {
            const active = statusFilter === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                size="xs"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => onStatusFilterChange(option.value)}
                className="gap-1.5"
              >
                <span>{option.label}</span>
                <span
                  data-numeric
                  className={
                    active
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }
                >
                  {counts[option.countKey]}
                </span>
              </Button>
            );
          })}
        </div>

        {showQuickMatches ? (
          <ul
            aria-label="Resultados rápidos"
            className="divide-y rounded-md border bg-background"
          >
            {matchingAccounts.map((account) => {
              const status = getAccountStatus(account);
              return (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => onFocusAccount(account)}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {account.displayName}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {account.city}/{account.state} ·{" "}
                      {ACCOUNT_STATUS_LABEL[status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
