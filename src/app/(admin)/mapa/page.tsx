import type { Metadata } from "next";
import { MapPage } from "@/components/map/map-page";

export const metadata: Metadata = {
  title: "Mapa",
};

export default function MapaRoute() {
  return <MapPage />;
}
