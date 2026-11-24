import type { SpottedMapAccount } from "@/mocks/spotteds-map";

export type SpottedAccountStatus = "active" | "needs_reauth" | "inactive";
export type SpottedStatusFilter = "all" | SpottedAccountStatus;

/**
 * Deriva o status exibido a partir dos campos de `instagram_accounts`.
 *
 * Precedência: conta inativa (`isActive === false`) tem prioridade sobre
 * `needsReauth`, mantendo coerência com `account-list.tsx`.
 */
export function getAccountStatus(
  account: Pick<SpottedMapAccount, "isActive" | "needsReauth">,
): SpottedAccountStatus {
  if (!account.isActive) return "inactive";
  if (account.needsReauth) return "needs_reauth";
  return "active";
}

export const ACCOUNT_STATUS_LABEL: Record<SpottedAccountStatus, string> = {
  active: "Ativa",
  needs_reauth: "Reconexão necessária",
  inactive: "Inativa",
};

export interface AccountStatusCounts {
  total: number;
  active: number;
  needs_reauth: number;
  inactive: number;
}

export function countByStatus(
  accounts: readonly SpottedMapAccount[],
): AccountStatusCounts {
  const counts: AccountStatusCounts = {
    total: accounts.length,
    active: 0,
    needs_reauth: 0,
    inactive: 0,
  };

  for (const account of accounts) {
    counts[getAccountStatus(account)] += 1;
  }

  return counts;
}

const intFormatter = new Intl.NumberFormat("pt-BR");

export function formatCount(value: number): string {
  return intFormatter.format(Math.round(value));
}

export function formatAccountDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
