"use client";

/**
 * Sessão admin e guard de rotas.
 *
 * O JWT fica no localStorage (sem BFF/cookie httpOnly), então toda a
 * proteção é client-side: o guard mostra carregando, valida o token guardado
 * com `/auth/me` e só então libera a tela.
 */

import { createContext, useContext } from "react";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearToken,
  getTokenSnapshot,
  setToken,
  subscribeToToken,
} from "./api-client";
import { fetchMe, login as loginRequest, qk } from "./api";
import type { AdminProfile } from "./types";

export interface AuthContextValue {
  admin: AdminProfile | null;
  isSuper: boolean;
  isAuthenticated: boolean;
  /** `true` enquanto validamos o token guardado no navegador. */
  isValidating: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const token = useSyncExternalStore(
    subscribeToToken,
    getTokenSnapshot,
    () => null,
  );

  const me = useQuery({
    queryKey: qk.me,
    queryFn: fetchMe,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      loginRequest(username, password),
    onSuccess: async (data) => {
      setToken(data.token);
      // Recarrega /auth/me para trazer as contas vinculadas e o created_at.
      await queryClient.invalidateQueries({ queryKey: qk.me });
    },
  });

  const logout = useCallback(() => {
    clearToken();
    queryClient.clear();
    router.replace("/login");
  }, [queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      admin: me.data?.admin ?? null,
      isSuper: me.data?.admin.is_super ?? false,
      isAuthenticated: Boolean(token) && Boolean(me.data?.admin),
      isValidating: Boolean(token) && me.isPending,
      login: async (username, password) => {
        await loginMutation.mutateAsync({ username, password });
      },
      logout,
    }),
    [me.data, me.isPending, token, loginMutation, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}

export interface GuardResult {
  /** `true` quando a tela pode ser exibida. */
  ready: boolean;
  isSuper: boolean;
}

/**
 * Protege uma área do painel.
 *
 * Sem token → vai para /login preservando o destino em `next`.
 * Token inválido → a camada HTTP já limpa a sessão e redireciona em 401.
 * Área restrita a super-admin → quem não é, volta para a fila.
 */
export function useAuthGuard(options?: { requireSuper?: boolean }): GuardResult {
  const requireSuper = options?.requireSuper ?? false;
  const { isAuthenticated, isValidating, isSuper } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const hasToken = isAuthenticated || isValidating;

  useEffect(() => {
    if (!hasToken) {
      const search =
        typeof window === "undefined" ? "" : window.location.search;
      const next = pathname === "/" ? "" : pathname + search;
      router.replace(
        next ? `/login?next=${encodeURIComponent(next)}` : "/login",
      );
      return;
    }

    if (requireSuper && !isValidating && !isSuper) {
      router.replace("/pending");
    }
  }, [hasToken, isValidating, isSuper, requireSuper, pathname, router]);

  return {
    ready: isAuthenticated && (!requireSuper || isSuper),
    isSuper,
  };
}

/** Mensagem de erro legível de qualquer falha, incluindo ApiError. */
export function errorMessage(error: unknown, fallback = "Algo deu errado."): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
