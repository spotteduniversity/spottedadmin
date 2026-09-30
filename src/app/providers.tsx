"use client";

/**
 * Providers globais do painel.
 *
 * O QueryClient é criado uma vez por render no servidor e reaproveitado no
 * browser, seguindo o padrão oficial do Next para TanStack Query.
 */

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  // `useState` garante um cliente por árvore de render no servidor.
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
