"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  RotateCcw,
  Sparkles,
  Terminal,
  ShieldAlert,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAuthGuard, errorMessage } from "@/lib/auth-context";
import { generateLongLivedToken } from "@/lib/api";
import type { LongLivedTokenResponse } from "@/lib/types";

function formatSecondsToDays(seconds?: number): string {
  if (!seconds || seconds <= 0) return "Longa duração (~60 dias)";
  const days = Math.round(seconds / 86400);
  return `Válido por aprox. ${days} dias (${seconds.toLocaleString("pt-BR")} segundos)`;
}

export default function LongLivedTokenPage() {
  const { ready } = useAuthGuard();

  const [tokenInput, setTokenInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<LongLivedTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!ready) {
    return (
      <PageBody>
        <div className="flex h-64 items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      </PageBody>
    );
  }

  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanToken = tokenInput.trim();

    if (!cleanToken) {
      setError("Por favor, informe o token de acesso (access_token).");
      return;
    }

    if (cleanToken.length < 20) {
      setError("O token informado parece curto demais para um token da Meta.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const data = await generateLongLivedToken(cleanToken);
      setResult(data);
      toast.success("Long-Lived Token gerado com sucesso!");
    } catch (err) {
      const msg = errorMessage(err, "Falha ao gerar Long-Lived Token.");
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy(text: string, key = "main", label = "Token") {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`${label} copiado para a área de transferência!`);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  }

  function handleReset() {
    setTokenInput("");
    setResult(null);
    setError(null);
    setCopiedKey(null);
  }

  return (
    <PageBody>
      <PageHeader
        title="Criar Long Lived"
        description="Troque um User Access Token temporário da Meta por um Long-Lived Token (60 dias) e obtenha Page Tokens para publicação no Instagram."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Coluna principal do formulário e resultado */}
        <div className="space-y-6 lg:col-span-8">
          {/* Card do formulário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="size-5 text-primary" />
                <span>Gerar Token de Longa Duração</span>
              </CardTitle>
              <CardDescription>
                Cole abaixo o token temporário (Short-Lived Token) obtido no Graph API Explorer.
                O backend fará a troca segura com a Meta usando o App ID e App Secret configurados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="token-input" className="text-sm font-medium">
                      Token de acesso atual (Short-Lived Token)
                    </Label>
                    {tokenInput && (
                      <button
                        type="button"
                        onClick={() => setTokenInput("")}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <Textarea
                    id="token-input"
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Cole aqui o token da Meta (ex: EAABw...)"
                    rows={4}
                    className="font-mono text-xs resize-none"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Certifique-se de que o token possua as permissões de Instagram e Páginas
                    (<code>instagram_basic</code>, <code>instagram_content_publish</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>).
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Erro ao processar solicitação</p>
                      <p>{error}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !tokenInput.trim()}
                    className="min-w-36"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner className="mr-2 size-4" />
                        <span>Gerando token…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 size-4" />
                        <span>Gerar Long Lived</span>
                      </>
                    )}
                  </Button>

                  {(tokenInput || result || error) && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleReset}
                      disabled={isSubmitting}
                    >
                      <RotateCcw className="mr-2 size-4" />
                      <span>Limpar tela</span>
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card com o resultado do Token Gerado */}
          {result && (
            <div className="space-y-6">
              {/* Token de Usuário de Longa Duração */}
              <Card className="border-primary/40 bg-card shadow-md">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                        <Check className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Long-Lived User Token Gerado!</CardTitle>
                        <CardDescription>
                          Token de usuário trocado com a Meta (válido por ~60 dias).
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-primary/50 text-primary">
                      {formatSecondsToDays(result.expires_in)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Long-Lived User Token
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Tipo: <code className="font-mono">{result.token_type || "bearer"}</code>
                      </span>
                    </div>

                    <div
                      onClick={() => handleCopy(result.access_token, "main", "User Token")}
                      role="button"
                      tabIndex={0}
                      title="Clique para copiar"
                      className="group relative cursor-pointer rounded-lg border bg-muted/60 p-4 transition hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="font-mono text-xs break-all leading-relaxed text-foreground select-all pr-8">
                        {result.access_token}
                      </p>
                      <div className="absolute right-3 top-3 text-muted-foreground group-hover:text-primary transition">
                        {copiedKey === "main" ? (
                          <Check className="size-4 text-emerald-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                    <Button
                      type="button"
                      onClick={() => handleCopy(result.access_token, "main", "User Token")}
                      variant={copiedKey === "main" ? "default" : "secondary"}
                      className="gap-2"
                    >
                      {copiedKey === "main" ? (
                        <>
                          <Check className="size-4 text-emerald-300" />
                          <span>Copiado para a área de transferência!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" />
                          <span>Copiar User Token</span>
                        </>
                      )}
                    </Button>

                    <Button asChild variant="outline" className="gap-2">
                      <Link href="/accounts">
                        <span>Ir para Contas e cidades</span>
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Páginas do Facebook vinculadas (Page Access Tokens) */}
              {result.pages && result.pages.length > 0 && (
                <Card className="border-emerald-500/40 bg-card shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="grid size-8 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Building className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          Páginas e Contas Conectadas ({result.pages.length})
                        </CardTitle>
                        <CardDescription>
                          Tokens de página (<strong>Page Tokens</strong>) têm permissão direta e <strong>nunca expiram</strong>! Recomendados para configurar em <em>Contas e cidades</em>.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.pages.map((page, idx) => {
                      const ig = page.instagram_business_account;
                      return (
                        <div
                          key={page.id}
                          className="rounded-lg border p-4 space-y-3 bg-muted/30"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{page.name}</span>
                              <Badge variant="secondary" className="text-[11px]">
                                Página ID: {page.id}
                              </Badge>
                            </div>
                            <Badge className="bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-emerald-600/30">
                              Never Expires
                            </Badge>
                          </div>

                          {ig ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/60 p-2.5 rounded border">
                              <ExternalLink className="size-4 text-pink-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-foreground">
                                  @{ig.username}
                                </span>{" "}
                                — IG User ID:{" "}
                                <code className="font-mono font-semibold text-foreground">
                                  {ig.id}
                                </code>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleCopy(ig.id, `ig-${page.id}`, "IG User ID")}
                              >
                                {copiedKey === `ig-${page.id}` ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                                <span className="ml-1">Copiar IG ID</span>
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Nenhuma conta Instagram Business vinculada a esta página no Meta Business Suite.
                            </p>
                          )}

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[11px] font-medium text-muted-foreground uppercase">
                                Page Access Token
                              </Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-primary"
                                onClick={() =>
                                  handleCopy(page.access_token, `token-${page.id}`, "Page Token")
                                }
                              >
                                {copiedKey === `token-${page.id}` ? (
                                  <>
                                    <Check className="size-3 text-emerald-500 mr-1" />
                                    <span>Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3 mr-1" />
                                    <span>Copiar Page Token</span>
                                  </>
                                )}
                              </Button>
                            </div>
                            <div
                              onClick={() =>
                                handleCopy(page.access_token, `token-${page.id}`, "Page Token")
                              }
                              role="button"
                              tabIndex={0}
                              className="group relative cursor-pointer rounded border bg-muted/60 p-2.5 font-mono text-[11px] break-all leading-tight text-foreground hover:border-primary transition"
                            >
                              {page.access_token}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Coluna lateral de ajuda e referência técnica */}
        <div className="space-y-6 lg:col-span-4">
          {/* Card explicativo do curl */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Terminal className="size-4 text-primary" />
                <span>Chamada da Meta Graph API</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Requisição executada pelo servidor para realizar a troca:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100 dark:bg-zinc-900 border overflow-x-auto">
                <p className="text-emerald-400 font-semibold">curl -i -X GET \</p>
                <p className="pl-2 text-zinc-300 break-all">
                  &quot;https://graph.facebook.com/v22.0/oauth/access_token?
                </p>
                <p className="pl-4 text-zinc-400">grant_type=fb_exchange_token&amp;</p>
                <p className="pl-4 text-zinc-400">client_id=<span className="text-amber-400">&#123;app-id&#125;</span>&amp;</p>
                <p className="pl-4 text-zinc-400">client_secret=<span className="text-amber-400">&#123;app-secret&#125;</span>&amp;</p>
                <p className="pl-4 text-zinc-400">fb_exchange_token=<span className="text-sky-400">&#123;access-token&#125;</span>&quot;</p>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  <strong>Como funciona:</strong> O <code>app-id</code> e <code>app-secret</code> ficam salvos com segurança no <code>.env</code> do servidor.
                </p>
                <p>
                  O token recebido é validado e trocado diretamente com a Meta pelo endpoint <code>fb_exchange_token</code>, retornando um token de longa duração (~60 dias).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dicas úteis de permissões */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldAlert className="size-4 text-amber-500" />
                <span>Permissões Obrigatórias</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p>
                Para publicar carrossel e imagens sem erros de <em>&quot;impersonating a user&apos;s page&quot;</em>, selecione estas permissões no Graph API Explorer:
              </p>
              <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-foreground">
                <li>instagram_basic</li>
                <li>instagram_content_publish</li>
                <li>pages_show_list</li>
                <li>pages_read_engagement</li>
              </ul>
              <p className="pt-1">
                <strong>Dica:</strong> Se você selecionar uma Página vinculada ao Instagram, use o <strong>Page Access Token</strong> retornado abaixo, pois ele <strong>nunca expira</strong>!
              </p>

              <div className="pt-2 border-t">
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                >
                  <span>Abrir Graph API Explorer</span>
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
