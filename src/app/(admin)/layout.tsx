"use client";

import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { useAuthGuard } from "@/lib/auth-context";

/**
 * Gate das telas do painel.
 *
 * Enquanto o token guardado no navegador é validado contra `/auth/me`,
 * mostramos um carregamento em vez de piscar conteúdo ou redirecionar
 * cedo demais. O `useAuthGuard` cuide do redirect quando não há sessão.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready } = useAuthGuard();

  if (!ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid min-h-dvh place-items-center"
      >
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-6" />
          <p className="text-sm text-muted-foreground">Carregando painel…</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
