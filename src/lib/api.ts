/**
 * Endpoints do painel admin + chaves de cache do TanStack Query.
 *
 * Cada função devolve o dado útil já desembrulhado de `{ success, ... }`,
 * e a query key fica declarada junto da chamada para que telas e mutations
 * nunca divirjam do contrato de cache.
 */

import { api } from "./api-client";
import type {
  Account,
  AccountCreateInput,
  AccountPatch,
  AccountResponse,
  AccountsResponse,
  AdminCreateInput,
  AdminListResponse,
  AdminResponse,
  AdminUpdateInput,
  AdminUser,
  ApproveResponse,
  LoginResponse,
  MeResponse,
  PendingPost,
  PendingResponse,
  PreviewResponse,
  LongLivedTokenResponse,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Query keys                                                                  */
/* -------------------------------------------------------------------------- */

export const qk = {
  me: ["auth", "me"] as const,
  accounts: (includeArchived: boolean) =>
    ["accounts", { includeArchived }] as const,
  allAccounts: ["accounts"] as const,
  pending: ["pending"] as const,
  admins: ["admins"] as const,
};

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export function login(username: string, password: string) {
  return api.post<LoginResponse>("/auth/login", { username, password }, { anonymous: true });
}

export function fetchMe() {
  return api.get<MeResponse>("/auth/me");
}

/* -------------------------------------------------------------------------- */
/* Contas                                                                      */
/* -------------------------------------------------------------------------- */

export async function fetchAccounts(includeArchived = false): Promise<Account[]> {
  const res = await api.get<AccountsResponse>("/accounts", {
    query: { include_archived: includeArchived ? "true" : undefined },
  });
  return res.accounts ?? [];
}

export async function createAccount(input: AccountCreateInput): Promise<Account> {
  const res = await api.post<AccountResponse>("/accounts", input);
  return res.account;
}

export async function patchAccount(id: string, patch: AccountPatch): Promise<Account> {
  const res = await api.patch<AccountResponse>(`/accounts/${id}`, patch);
  return res.account;
}

export async function setAccountArchived(
  id: string,
  archived: boolean,
): Promise<Account> {
  const res = await api.post<AccountResponse>(
    `/accounts/${id}/${archived ? "archive" : "unarchive"}`,
  );
  return res.account;
}

/**
 * Envia base ou template. Usa FormData, então o Content-Type fica por conta
 * do browser para que o boundary do multipart seja montado corretamente.
 */
export async function uploadAccountAsset(
  id: string,
  kind: "base" | "template",
  file: File,
): Promise<Account> {
  const form = new FormData();
  // `kind` primeiro: alguns proxies/multer precisam do campo antes do arquivo.
  form.append("kind", kind);
  form.append("file", file);

  const res = await api.post<AccountResponse>(`/accounts/${id}/assets`, form);
  return res.account;
}

/**
 * Upload de logo da conta (.png/.jpg). Sobe pro bucket público spotted-assets
 * e salva a URL na coluna spotted_logo do banco.
 */
export async function uploadAccountLogo(
  id: string,
  file: File,
): Promise<Account> {
  const form = new FormData();
  form.append("file", file);

  const res = await api.post<AccountResponse>(`/accounts/${id}/logo`, form);
  return res.account;
}

/**
 * Credenciais de publicação de uma conta.
 *
 * Não há OAuth: o admin gera um token de longa duração no Graph API Explorer
 * e cola ele + o IG User ID. O backend valida o par contra a Meta antes de
 * gravar e devolve a conta com `has_token` — o segredo em si nunca volta para
 * o painel.
 */
export interface AccountCredentials {
  access_token: string;
  ig_user_id: string;
}

export async function saveAccountCredentials(
  id: string,
  credentials: AccountCredentials,
): Promise<Account> {
  const res = await api.put<AccountResponse>(`/accounts/${id}/credentials`, credentials);
  return res.account;
}

/* -------------------------------------------------------------------------- */
/* Fila de aprovação                                                           */
/* -------------------------------------------------------------------------- */

export async function fetchPending(): Promise<PendingPost[]> {
  const res = await api.get<PendingResponse>("/pending");
  return res.posts ?? [];
}

export function approvePost(id: string) {
  return api.post<ApproveResponse>(`/approve/${id}`);
}

export function rejectPost(id: string) {
  return api.post<{ success: boolean; message: string }>(`/reject/${id}`);
}

export function previewCard(accountId: string, content: string) {
  return api.post<PreviewResponse>("/preview", { accountId, content });
}

/* -------------------------------------------------------------------------- */
/* Administradores                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `POST /users` e `PUT /users/:id` respondem via `findById`, que não carrega
 * as vinculações de contas. Preenchemos com `[]` para não quebrar a tabela
 * e deixamos a revalidação da lista trazer os ids reais.
 */
function normalizeAdmin(admin: AdminUser): AdminUser {
  return { ...admin, account_ids: admin.account_ids ?? [] };
}

export async function fetchAdmins(): Promise<AdminUser[]> {
  const res = await api.get<AdminListResponse>("/users");
  return (res.admins ?? []).map(normalizeAdmin);
}

export async function createAdmin(input: AdminCreateInput): Promise<AdminUser> {
  const res = await api.post<AdminResponse>("/users", input);
  return normalizeAdmin(res.admin);
}

export async function updateAdmin(
  id: string,
  input: AdminUpdateInput,
): Promise<AdminUser> {
  const res = await api.put<AdminResponse>(`/users/${id}`, input);
  return normalizeAdmin(res.admin);
}

export function deleteAdmin(id: string) {
  return api.delete<{ success: boolean; message: string }>(`/users/${id}`);
}

/* -------------------------------------------------------------------------- */
/* Long-Lived Token                                                           */
/* -------------------------------------------------------------------------- */

export async function generateLongLivedToken(
  accessToken: string,
): Promise<LongLivedTokenResponse> {
  const res = await api.post<LongLivedTokenResponse>("/long-lived-token", {
    access_token: accessToken,
  });
  return res;
}

