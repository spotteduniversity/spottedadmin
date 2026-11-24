"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { SpottedMapAccount } from "@/mocks/spotteds-map";
import { ACCOUNT_STATUS_LABEL, getAccountStatus } from "./map-utils";

export interface SpottedMarkerProps {
  account: SpottedMapAccount;
  isSelected: boolean;
  onSelect: (account: SpottedMapAccount) => void;
}

export function SpottedMarker({
  account,
  isSelected,
  onSelect,
}: SpottedMarkerProps) {
  const status = getAccountStatus(account);
  const isFeatured = account.slug === "limeira";

  const icon = useMemo(() => {
    const size = isFeatured ? 26 : 22;
    return L.divIcon({
      className: "spotted-marker-icon",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<span class="spotted-marker-pin" data-status="${status}" data-selected="${isSelected}" data-featured="${isFeatured}"></span>`,
    });
  }, [status, isSelected, isFeatured]);

  const label = `${account.displayName} — ${account.city}/${account.state} (${ACCOUNT_STATUS_LABEL[status]})`;

  return (
    <Marker
      position={[account.lat, account.lng]}
      icon={icon}
      title={label}
      alt={label}
      zIndexOffset={isSelected ? 500 : isFeatured ? 200 : 0}
      eventHandlers={{
        click: () => onSelect(account),
      }}
    />
  );
}
