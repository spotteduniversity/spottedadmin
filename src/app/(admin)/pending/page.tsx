"use client";

/**
 * Fila de aprovação.
 *
 * A API devolve todos os posts PENDING do escopo do admin; os filtros
 * (busca, conta e período) rodam no client. Aprovar e rejeitar usam
 * atualização otimista da lista, com rollback em caso de erro.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Inbox,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/auth-context";
import { approvePost, fetchPending, previewCard, qk, rejectPost } from "@/lib/api";
import type { PendingPost } from "@/lib/types";

type Period = "all" | "today" | "7d" | "30d";

const PERIOD_LABEL: Record<Period, string> = {
  all: "Qualquer data",
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function matchesPeriod(createdAt: string, period: Period): boolean {
  if (period === "all") return true;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true;

  if (period === "today") return created >= startOfDay(new Date());
  const days = period === "7d" ? 7 : 30;
  return created >= startOfDay(new Date()) - (days - 1) * 86_400_000;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function accountName(post: PendingPost): string {
  return post.instagram_accounts?.display_name || post.instagram_accounts?.username || "Conta desconhecida";
}

export default function PendingPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [period, setPeriod] = useState<Period>("all");

  const [previewPost, setPreviewPost] = useState<PendingPost | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const posts = useQuery({
    queryKey: qk.pending,
    queryFn: fetchPending,
  });

  // Opções de conta vêm dos próprios posts, evitando uma requisição extra.
  const accountOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const post of posts.data ?? []) {
      map.set(post.instagram_account_id, accountName(post));
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [posts.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (posts.data ?? []).filter((post) => {
      if (accountId !== "all" && post.instagram_account_id !== accountId) return false;
      if (!matchesPeriod(post.created_at, period)) return false;
      if (!term) return true;
      return (
        post.content.toLowerCase().includes(term) ||
        accountName(post).toLowerCase().includes(term)
      );
    });
  }, [posts.data, accountId, period, search]);

  /** Remove o post da fila de forma otimista e volta atrás se falhar. */
  function useDecide(action: "approve" | "reject") {
    return useMutation({
      mutationFn: (id: string) =>
        action === "approve" ? approvePost(id) : rejectPost(id),
      onMutate: async (id) => {
        await queryClient.cancelQueries({ queryKey: qk.pending });
        const previous = queryClient.getQueryData<PendingPost[]>(qk.pending);
        queryClient.setQueryData<PendingPost[]>(
          qk.pending,
          (current) => (current ?? []).filter((post) => post.id !== id),
        );
        return { previous };
      },
      onError: (error, _id, context) => {
        if (context?.previous) {
          queryClient.setQueryData(qk.pending, context.previous);
        }
        toast.error(errorMessage(error, "Não foi possível concluir a ação."));
      },
      onSuccess: (result) => {
        const data = result as { message?: string };
        toast.success(data?.message || (action === "approve" ? "Post aprovado." : "Post rejeitado."));
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: qk.pending });
      },
    });
  }

  const approve = useDecide("approve");
  const reject = useDecide("reject");

  const preview = useMutation({
    mutationFn: ({ accountIdParam, content }: { accountIdParam: string; content: string }) =>
      previewCard(accountIdParam, content),
    onSuccess: (data) => setPreviewImage(data.imageBase64),
    onError: (error) =>
      toast.error(errorMessage(error, "Não foi possível gerar o preview.")),
  });

  function openPreview(post: PendingPost) {
    setPreviewPost(post);
    setPreviewImage(null);
    preview.mutate({
      accountIdParam: post.instagram_account_id,
      content: post.content,
    });
  }

  const total = posts.data?.length ?? 0;
  const filtersActive = search.trim() !== "" || accountId !== "all" || period !== "all";

  return (
    <PageBody>
      <PageHeader
        title="Fila de aprovação"
        description="Revise e publique os posts enviados pelos usuários."
        actions={
          <Button
            variant="outline"
            onClick={() => posts.refetch()}
            disabled={posts.isFetching}
          >
            {posts.isFetching ? (
              <Spinner className="size-4" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Atualizar
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Label htmlFor="busca" className="sr-only">
                Buscar posts
              </Label>
              <Input
                id="busca"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por conteúdo ou cidade…"
                className="pl-9"
              />
            </div>

            <div>
              <Label htmlFor="conta" className="sr-only">
                Filtrar por cidade
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="conta" className="w-full sm:w-52">
                  <SelectValue placeholder="Todas as cidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {accountOptions.map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="periodo" className="sr-only">
                Filtrar por período
              </Label>
              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as Period)}
              >
                <SelectTrigger id="periodo" className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERIOD_LABEL) as Period[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {PERIOD_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              {filtered.length === total
                ? `${total} ${total === 1 ? "post" : "posts"} aguardando`
                : `${filtered.length} de ${total} posts`}
            </span>
            {filtersActive ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSearch("");
                  setAccountId("all");
                  setPeriod("all");
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {posts.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <CardContent className="space-y-3 py-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">
              {errorMessage(posts.error, "Falha ao carregar a fila.")}
            </p>
            <Button variant="outline" onClick={() => posts.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span
              aria-hidden
              className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"
            >
              <Inbox className="size-6" />
            </span>
            <div>
              <p className="font-medium">
                {filtersActive ? "Nenhum post com esses filtros" : "Fila vazia"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtersActive
                  ? "Ajuste a busca, a cidade ou o período para ver outros posts."
                  : "Não há posts aguardando revisão agora."}
              </p>
            </div>
            {filtersActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setAccountId("all");
                  setPeriod("all");
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((post) => {
            const busyId =
              approve.isPending && approve.variables === post.id
                ? "approve"
                : reject.isPending && reject.variables === post.id
                  ? "reject"
                  : null;

            return (
              <li key={post.id}>
                <Card className="transition-shadow hover:shadow-sm">
                  <CardContent className="space-y-4 py-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="status-dot" />
                        {accountName(post)}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays aria-hidden className="size-3.5" />
                        {formatDate(post.created_at)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                          {post.content}
                        </p>
                        {post.image_url ? (
                          // URL externa do bucket do usuário e tamanho
                          // desconhecido: o otimizador do next/image não se aplica.
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={post.image_url}
                            alt="Imagem enviada junto ao post"
                            className="max-h-40 rounded-md border object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPreview(post)}
                          disabled={busyId !== null}
                        >
                          <Sparkles className="size-4" />
                          Ver card
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reject.mutate(post.id)}
                          disabled={busyId !== null}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          {busyId === "reject" ? (
                            <Spinner className="size-4" />
                          ) : (
                            <X className="size-4" />
                          )}
                          Rejeitar
                        </Button>
                        <Button size="sm" onClick={() => approve.mutate(post.id)} disabled={busyId !== null}>
                          {busyId === "approve" ? (
                            <Spinner className="size-4" />
                          ) : (
                            <Check className="size-4" />
                          )}
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={Boolean(previewPost)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewPost(null);
            setPreviewImage(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preview do card</DialogTitle>
            <DialogDescription>
              {previewPost ? accountName(previewPost) : null} — como o post será
              publicado.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
            {preview.isPending ? (
              <div role="status" className="flex flex-col items-center gap-2">
                <Spinner className="size-6" />
                <p className="text-sm text-muted-foreground">Gerando card…</p>
              </div>
            ) : previewImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewImage}
                alt="Preview gerado do card"
                className="max-h-[70vh] w-auto object-contain"
              />
            ) : (
              <p className="px-4 text-center text-sm text-muted-foreground">
                Não foi possível gerar o preview.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
