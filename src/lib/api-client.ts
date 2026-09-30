/**
 * Cliente HTTP do painel admin.
 *
 * O token JWT vive no `localStorage` (decisão conscious: sem BFF e sem
 * cookie httpOnly). Tudo aqui roda no browser, então `localStorage` só é
 * tocado depois do guard de `typeof window`.
 */

const TOKEN_STORAGE_KEY = "adminToken";
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:3001/api/admin";

/** Erro normalizado, com o status HTTP para decisões de UI. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  /** 401/403 viram tela de login ou mensagem de permissão. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Erro de validação do backend, com campo opcional. */
  get isValidationError(): boolean {
    return this.status === 400 || this.status === 409 || this.status === 415;
  }
}

/* -------------------------------------------------------------------------- */
/* Token                                                                       */
/* -------------------------------------------------------------------------- */

let cachedToken: string | null = null;
let cacheLoaded = false;
const listeners = new Set<() => void>();

function readToken(): string | null {
  if (cacheLoaded) return cachedToken;
  if (typeof window === "undefined") return null;
  try {
    cachedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage pode estar bloqueado (modo privado / cookies desligados).
    cachedToken = null;
  }
  cacheLoaded = true;
  return cachedToken;
}

export function getToken(): string | null {
  return readToken();
}

export function setToken(token: string): void {
  cachedToken = token;
  cacheLoaded = true;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Sem persistência: a sessão ainda vale para a aba atual.
  }
  emit();
}

export function clearToken(): void {
  cachedToken = null;
  cacheLoaded = true;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignora: já estamos sem token em memória.
  }
  emit();
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Assina mudanças de token. Usado pelo AuthProvider via useSyncExternalStore. */
export function subscribeToToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot estável para useSyncExternalStore (mesma referência quando não muda). */
export function getTokenSnapshot(): string | null {
  return readToken();
}

/* -------------------------------------------------------------------------- */
/* Redirect em 401                                                             */
/* -------------------------------------------------------------------------- */

let redirecting = false;

/**
 * Limpa a sessão e manda para /login.
 * Só roda no browser e nunca durante o próprio login, para evitar loop.
 */
function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  if (redirecting) return;

  redirecting = true;
  clearToken();

  const next = window.location.pathname + window.location.search;
  const target = next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";
  window.location.replace(target);
}

/* -------------------------------------------------------------------------- */
/* Fetch                                                                       */
/* -------------------------------------------------------------------------- */

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Rotas públicas não recebem Bearer nem redirecionam em 401. */
  anonymous?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data.message === "string" && data.message) {
      return data.message;
    }
  } catch {
    // Corpo não-JSON (ex.: 502 do proxy).
  }
  return response.status === 401
    ? "Sessão expirada. Entre novamente."
    : "Não foi possível concluir a operação.";
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, anonymous, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);
  const token = readToken();
  if (token && !anonymous) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  // O browser define o boundary do multipart; não podemos setar Content-Type.
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      headers: requestHeaders,
      body: payload,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      "Não foi possível falar com o servidor. Verifique se a API está no ar.",
      0,
    );
  }

  if (!response.ok) {
    const message = await readError(response);
    if (response.status === 401 && !anonymous) handleUnauthorized();
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as unknown as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

export { BASE_URL };
