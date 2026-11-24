"use client";

import { useEffect, useState, type ComponentProps } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { LocateFixed, Minus, Moon, Plus, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SpottedMapAccount } from "@/mocks/spotteds-map";
import { SpottedMarker } from "./spotted-marker";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

// Região central do interior de São Paulo (Limeira / Rio Claro / Piracicaba / Campinas).
const DEFAULT_CENTER: [number, number] = [-22.45, -47.65];
const DEFAULT_ZOOM = 8;
const MIN_ZOOM = 5;
const MAX_ZOOM = 18;
const FOCUS_ZOOM = 11;

// Chave hardcoded da API CARTO Basemaps para o painel.
const CARTO_API_KEY = "cb1_3m66_1_830bb0c167829f9c2ecb3d38";

export type MapTheme = "light" | "dark";

const CARTO_TILE_URLS: Record<MapTheme, string> = {
  light: `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
  dark: `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`,
};

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

type ClusterIconFn = NonNullable<
  ComponentProps<typeof MarkerClusterGroup>["iconCreateFunction"]
>;

const createClusterIcon: ClusterIconFn = (cluster) => {
  const count = cluster.getChildCount();
  const size = count >= 10 ? 38 : 32;

  return L.divIcon({
    html: `<span class="spotted-cluster-badge">${count}</span>`,
    className: "spotted-cluster-icon",
    iconSize: L.point(size, size, true),
  });
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface MapControllerProps {
  selectedAccount: SpottedMapAccount | null;
  resetTrigger: number;
  onClearSelection: () => void;
  onZoomChange: (zoom: number) => void;
}

function MapController({
  selectedAccount,
  resetTrigger,
  onClearSelection,
  onZoomChange,
}: MapControllerProps) {
  const map = useMap();

  useMapEvents({
    click: () => onClearSelection(),
    zoomend: () => onZoomChange(map.getZoom()),
  });

  useEffect(() => {
    if (!selectedAccount) return;
    const targetZoom = Math.max(map.getZoom(), FOCUS_ZOOM);
    map.flyTo([selectedAccount.lat, selectedAccount.lng], targetZoom, {
      animate: !prefersReducedMotion(),
      duration: 0.7,
    });
  }, [map, selectedAccount]);

  useEffect(() => {
    if (resetTrigger === 0) return;
    map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
      animate: !prefersReducedMotion(),
      duration: 0.6,
    });
  }, [map, resetTrigger]);

  return null;
}

interface MapControlsProps {
  zoom: number;
  mapTheme: MapTheme;
  onToggleTheme: () => void;
  onResetView: () => void;
  hideOnMobile?: boolean;
}

function MapControls({
  zoom,
  mapTheme,
  onToggleTheme,
  onResetView,
  hideOnMobile,
}: MapControlsProps) {
  const map = useMap();

  return (
    <div
      data-map-control="true"
      aria-label="Controles do mapa"
      className={[
        "pointer-events-auto absolute right-2.5 bottom-7 z-[410] flex flex-col gap-1.5 sm:right-4 sm:bottom-8",
        hideOnMobile ? "hidden md:flex" : "flex",
      ].join(" ")}
    >
      <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-lg">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => map.zoomIn()}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
          className="size-9 rounded-none border-b md:size-8"
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => map.zoomOut()}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Diminuir zoom"
          title="Diminuir zoom"
          className="size-9 rounded-none md:size-8"
        >
          <Minus className="size-4" />
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onResetView}
        aria-label="Centralizar no interior de São Paulo"
        title="Centralizar região"
        className="size-9 bg-card shadow-lg md:size-8"
      >
        <LocateFixed className="size-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={onToggleTheme}
        aria-label={
          mapTheme === "light"
            ? "Alternar para mapa escuro"
            : "Alternar para mapa claro"
        }
        title={mapTheme === "light" ? "Mapa escuro" : "Mapa claro"}
        className="size-9 bg-card shadow-lg md:size-8"
      >
        {mapTheme === "light" ? (
          <Moon className="size-4" />
        ) : (
          <Sun className="size-4" />
        )}
      </Button>
    </div>
  );
}

export interface SpottedMapProps {
  accounts: SpottedMapAccount[];
  selectedAccount: SpottedMapAccount | null;
  clusterKey: string;
  resetTrigger: number;
  mapTheme: MapTheme;
  onToggleTheme: () => void;
  onSelectAccount: (account: SpottedMapAccount) => void;
  onClearSelection: () => void;
  onResetView: () => void;
}

export function SpottedMap({
  accounts,
  selectedAccount,
  clusterKey,
  resetTrigger,
  mapTheme,
  onToggleTheme,
  onSelectAccount,
  onClearSelection,
  onResetView,
}: SpottedMapProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      zoomControl={false}
      className="h-full w-full outline-none"
    >
      <TileLayer
        key={mapTheme}
        url={CARTO_TILE_URLS[mapTheme]}
        attribution={CARTO_ATTRIBUTION}
        subdomains="abcd"
      />

      <MapController
        selectedAccount={selectedAccount}
        resetTrigger={resetTrigger}
        onClearSelection={onClearSelection}
        onZoomChange={setZoom}
      />

      <MarkerClusterGroup
        key={clusterKey}
        chunkedLoading
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={46}
        iconCreateFunction={createClusterIcon}
      >
        {accounts.map((account) => (
          <SpottedMarker
            key={account.id}
            account={account}
            isSelected={selectedAccount?.id === account.id}
            onSelect={onSelectAccount}
          />
        ))}
      </MarkerClusterGroup>

      <MapControls
        zoom={zoom}
        mapTheme={mapTheme}
        onToggleTheme={onToggleTheme}
        onResetView={onResetView}
        hideOnMobile={Boolean(selectedAccount)}
      />
    </MapContainer>
  );
}
