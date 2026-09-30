"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth-context";

const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Informe seu usuário.")
    .max(80, "Usuário longo demais."),
  password: z
    .string()
    .min(1, "Informe sua senha.")
    .max(200, "Senha longa demais."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isValidating } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  // `next` só é lido no browser, num inicializador preguiçoso para não
  // precisar de effect (e nem de boundary de Suspense).
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return "/pending";
    const raw = new URLSearchParams(window.location.search).get("next");
    return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/pending";
  });

  // Já há sessão válida: não faz sentido mostrar o formulário.
  useEffect(() => {
    if (isAuthenticated) router.replace(nextPath);
  }, [isAuthenticated, nextPath, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const busy = isSubmitting || isValidating;

  async function onSubmit(values: LoginValues) {
    try {
      await login(values.username.trim(), values.password);
      toast.success("Bem-vindo de volta.");
      router.replace(nextPath);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-xl bg-foreground text-lg font-bold text-background"
          >
            S
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Spotted</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre para acessar o painel administrativo.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrar</CardTitle>
            <CardDescription>
              Use suas credenciais de administrador.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={errors.username ? "username-error" : undefined}
                  {...register("username")}
                />
                {errors.username ? (
                  <p id="username-error" role="alert" className="text-xs text-destructive">
                    {errors.username.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="pr-10"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                {errors.password ? (
                  <p id="password-error" role="alert" className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="h-10 w-full" disabled={busy}>
                {busy ? <Spinner className="size-4" /> : null}
                {busy ? "Entrando…" : "Entrar"}
              </Button>

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Após 5 tentativas inválidas o acesso fica bloqueado por 15
                  minutos.
                </span>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
