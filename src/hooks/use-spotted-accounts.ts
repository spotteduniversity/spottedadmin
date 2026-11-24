"use client";

/**
 * Camada de acesso aos dados do mapa.
 *
 * Lê a view `public.spotted_map_accounts` através do backend admin
 * (`GET /api/admin/accounts/map`), convertendo snake_case para `SpottedMapAccount`.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchMapAccounts, qk } from "@/lib/api";

export function useSpottedAccounts() {
  return useQuery({
    queryKey: qk.mapAccounts,
    queryFn: fetchMapAccounts,
    staleTime: 60 * 1000,
  });
}
