"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useSpottedAccounts } from "@/hooks/use-spotted-accounts";
import type { SpottedMapAccount } from "@/mocks/spotteds-map";
import { MapFilters } from "./map-filters";
import { MapLegend } from "./map-legend";
import {
  countByStatus,
  getAccountStatus,
  type SpottedStatusFilter,
} from "./map-utils";
import type { MapTheme } from "./spotted-map";
import { SpottedCard } from "./spotted-card";

function MapLoadingPlaceholder() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid h-full w-full place-items-center bg-background text-foreground"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-6" />
        <p className="text-sm text-muted-foreground">Carregando mapa…</p>
      </div>
    </div>
  );
}

const DynamicSpottedMap = dynamic(
  () => import("./spotted-map").then((mod) => mod.SpottedMap),
  {
    ssr: false,
    loading: () => <MapLoadingPlaceholder />,
  },
);

export function MapPage() {
  const { data, isPending, isError, refetch } = useSpottedAccounts();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SpottedStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [mapTheme, setMapTheme] = useState<MapTheme>("light");

  const accounts = useMemo(() => data ?? [], [data]);
  const counts = useMemo(() => countByStatus(accounts), [accounts]);

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (statusFilter !== "all" && getAccountStatus(account) !== statusFilter) {
        return false;
      }
      if (!term) return true;
      return (
        account.city.toLowerCase().includes(term) ||
        account.displayName.toLowerCase().includes(term) ||
        account.username.toLowerCase().includes(term)
      );
    });
  }, [accounts, search, statusFilter]);

  const selectedAccount = useMemo(
    () =>
      selectedId
        ? (filteredAccounts.find((account) => account.id === selectedId) ?? null)
        : null,
    [filteredAccounts, selectedId],
  );

  const handleSelectAccount = useCallback((account: SpottedMapAccount) => {
    setSelectedId(account.id);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setSelectedId(null);
    setResetTrigger((current) => current + 1);
  }, []);

  const handleResetView = useCallback(() => {
    setSelectedId(null);
    setResetTrigger((current) => current + 1);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setMapTheme((current) => (current === "light" ? "dark" : "light"));
  }, []);

  const filtersActive = search.trim() !== "" || statusFilter !== "all";
  const clusterKey = `${statusFilter}:${filteredAccounts.length}:${search.trim()}`;

  return (
    <section
      aria-label="Mapa regional de contas do Spotted"
      data-map-theme={mapTheme}
      className="relative h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] w-full overflow-hidden overscroll-none md:h-dvh"
    >
      {isPending ? (
        <MapLoadingPlaceholder />
      ) : isError ? (
        <div className="grid h-full w-full place-items-center bg-background p-4">
          <Card className="w-full max-w-md">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangle />
                </EmptyMedia>
                <EmptyTitle>Não foi possível carregar o mapa</EmptyTitle>
                <EmptyDescription>
                  Ocorreu uma falha ao buscar as contas regionais.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </EmptyContent>
            </Empty>
          </Card>
        </div>
      ) : (
        <>
          <DynamicSpottedMap
            accounts={filteredAccounts}
            selectedAccount={selectedAccount}
            clusterKey={clusterKey}
            resetTrigger={resetTrigger}
            mapTheme={mapTheme}
            onToggleTheme={handleToggleTheme}
            onSelectAccount={handleSelectAccount}
            onClearSelection={handleClearSelection}
            onResetView={handleResetView}
          />

          <MapFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            counts={counts}
            matchingAccounts={filteredAccounts}
            onFocusAccount={handleSelectAccount}
          />

          <MapLegend
            counts={counts}
            className={selectedAccount ? "hidden md:block" : undefined}
          />

          {filteredAccounts.length === 0 ? (
            <div
              data-map-control="true"
              className="pointer-events-none absolute inset-0 z-[405] grid place-items-center p-4"
            >
              <Card className="pointer-events-auto w-full max-w-sm shadow-xl">
                <Empty className="p-6 md:p-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MapPin />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma página encontrada</EmptyTitle>
                    <EmptyDescription>
                      {filtersActive
                        ? "Nenhuma conta corresponde à busca ou ao filtro selecionado."
                        : "Nenhuma conta com localização cadastrada."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {filtersActive ? (
                    <EmptyContent>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                      >
                        Limpar filtros
                      </Button>
                    </EmptyContent>
                  ) : null}
                </Empty>
              </Card>
            </div>
          ) : null}

          {selectedAccount ? (
            <SpottedCard
              account={selectedAccount}
              onClose={handleClearSelection}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
