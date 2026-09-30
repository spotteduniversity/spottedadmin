"use client";

/**
 * Contas e cidades.
 *
 * Não existe exclusão de contas: cada uma tem posts e histórico de
 * publicação, então o controle é arquivar/restaurar (`is_active`).
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  KeyRound,
  Image as ImageIcon,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Undo2,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { errorMessage } from "@/lib/auth-context";
import {
  createAccount,
  fetchAccounts,
  type AccountCredentials,
  patchAccount,
  qk,
  saveAccountCredentials,
  setAccountArchived,
  uploadAccountAsset,
} from "@/lib/api";
import { type Account } from "@/lib/types";
import { AccountFormDialog, type AccountFormValues } from "./account-form-dialog";
import { CredentialsDialog } from "./credentials-dialog";

type FormTarget = { mode: "create" } | { mode: "edit"; account: Account };
type AssetKind = "base" | "template";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

/**
 * A coluna `connection_status` só aceita 'ok' | 'needs_reauth' (CHECK no
 * banco), então estes são os únicos estados reais de uma conta ativa.
 */
function connectionLabel(account: Account): { text: string; muted: boolean } {
  if (!account.is_active) return { text: "Arquivada", muted: true };
  if (account.connection_status === "ok" && !account.needs_reauth) {
    return { text: "Conectada", muted: false };
  }
  return { text: "Reconectar", muted: false };
}

export default function AccountsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Account | null>(null);
  const [credentialsFor, setCredentialsFor] = useState<Account | null>(null);

  const accounts = useQuery({
    queryKey: qk.accounts(includeArchived),
    queryFn: () => fetchAccounts(includeArchived),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts.data ?? [];
    return (accounts.data ?? []).filter(
      (account) =>
        (account.display_name ?? "").toLowerCase().includes(term) ||
        account.username.toLowerCase().includes(term) ||
        (account.slug ?? "").toLowerCase().includes(term),
    );
  }, [accounts.data, search]);

  function invalidateAccounts() {
    void queryClient.invalidateQueries({ queryKey: qk.allAccounts });
  }

  /**
   * Salva o modal inteiro numa mutation só.
   *
   * Ordem importa: os assets vão para `POST /:id/assets`, que precisa do id.
   * Na criação, portanto, primeiro criamos a conta e só depois subimos as
   * imagens. Falha no meio deixa o modal aberto com o que já foi salvo.
   */
  const saveMutation = useMutation({
    mutationFn: async ({
      values,
      account,
    }: {
      values: AccountFormValues;
      account: Account | null;
    }) => {
      let target = account;

      if (target) {
        target = await patchAccount(target.id, {
          display_name: values.display_name,
          // `undefined` deixa o valor atual intacto no backend.
          username: values.username,
          slug: values.slug,
          text_color: values.text_color,
          shadow_color: values.shadow_color,
        });
      } else {
        target = await createAccount({
          display_name: values.display_name,
          username: values.username,
        });
        // A criação fixa cores e slug padrão; aplica o que foi escolhido aqui.
        if (values.slug || values.text_color || values.shadow_color) {
          target = await patchAccount(target.id, {
            slug: values.slug,
            text_color: values.text_color,
            shadow_color: values.shadow_color,
          });
        }
      }

      const entries = Object.entries(values.assets) as Array<[AssetKind, File | undefined]>;
      for (const [kind, file] of entries) {
        if (file) await uploadAccountAsset(target.id, kind, file);
      }

      return target;
    },
    onSuccess: (account, { values, account: previous }) => {
      const uploaded = Object.keys(values.assets).length;
      toast.success(
        previous
          ? "Cidade atualizada."
          : `Cidade "${account.display_name}" criada.`,
      );
      if (uploaded > 0) {
        toast.success(`${uploaded} ${uploaded === 1 ? "imagem enviada" : "imagens enviadas"}.`);
      }
      setFormTarget(null);
      invalidateAccounts();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Falha ao salvar a cidade.")),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      setAccountArchived(id, archived),
    onSuccess: (account) => {
      toast.success(account.is_active ? "Conta restaurada." : "Conta arquivada.");
      setArchiveTarget(null);
      invalidateAccounts();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Falha ao alterar o status da conta.")),
  });

  const credentialsMutation = useMutation({
    mutationFn: ({
      id,
      credentials,
    }: {
      id: string;
      credentials: AccountCredentials;
    }) => saveAccountCredentials(id, credentials),
    onSuccess: (account) => {
      toast.success(`Credenciais salvas para @${account.username}.`);
      // Mantém o modal aberto, mas aponta para a conta recém-atualizada para
      // que o indicador de status mude na hora.
      setCredentialsFor((current) =>
        current && current.id === account.id ? account : current,
      );
      invalidateAccounts();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Falha ao salvar as credenciais.")),
  });

  const isBusy = saveMutation.isPending || archiveMutation.isPending;

  function handleFormSubmit(values: AccountFormValues) {
    saveMutation.mutate({
      values,
      account: formTarget?.mode === "edit" ? formTarget.account : null,
    });
  }

  return (
    <PageBody>
      <PageHeader
        title="Contas e cidades"
        description="Cada conta do Instagram publica os posts de uma cidade."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => accounts.refetch()}
              disabled={accounts.isFetching}
            >
              {accounts.isFetching ? (
                <Spinner className="size-4" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Atualizar
            </Button>
            <Button onClick={() => setFormTarget({ mode: "create" })}>
              <Plus className="size-4" />
              Nova conta
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Label htmlFor="busca-contas" className="sr-only">
              Buscar contas
            </Label>
            <Input
              id="busca-contas"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cidade, usuário ou slug…"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <Label htmlFor="arquivadas" className="text-sm text-muted-foreground">
              Mostrar arquivadas
            </Label>
            <Switch
              id="arquivadas"
              checked={includeArchived}
              onCheckedChange={setIncludeArchived}
            />
          </div>
        </CardContent>
      </Card>

      {accounts.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <Card key={index}>
              <CardContent className="space-y-3 py-5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">
              {errorMessage(accounts.error, "Falha ao carregar as contas.")}
            </p>
            <Button variant="outline" onClick={() => accounts.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="font-medium">
              {search.trim() ? "Nenhuma conta encontrada" : "Nenhuma conta cadastrada"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {search.trim()
                ? "Tente outro termo de busca."
                : "Crie a primeira conta e depois conecte o Instagram."}
            </p>
            {!search.trim() ? (
              <Button size="sm" onClick={() => setFormTarget({ mode: "create" })}>
                <Plus className="size-4" />
                Nova conta
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((account) => {
            const status = connectionLabel(account);
            const expiresAt = formatDate(account.token_expires_at);

            return (
              <li key={account.id}>
                <Card className="flex h-full flex-col">
                  <CardContent className="flex h-full flex-col gap-4 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold">
                          {account.display_name || "Sem nome"}
                        </h2>
                        <p className="truncate text-sm text-muted-foreground">
                          @{account.username}
                          {account.slug ? (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Link2 aria-hidden className="size-3" />
                              {account.slug}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
                        <span
                          aria-hidden
                          className={status.muted ? "status-dot-muted" : "status-dot"}
                        />
                        {status.text}
                      </span>
                    </div>

                    {account.needs_reauth && account.is_active ? (
                      <p className="flex items-start gap-2 rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
                        <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Reconexão necessária para voltar a publicar.
                          {account.last_error ? ` (${account.last_error})` : ""}
                        </span>
                      </p>
                    ) : null}

                    {!account.needs_reauth && account.last_error && account.is_active ? (
                      <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        <span className="break-words">{account.last_error}</span>
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <ImageIcon aria-hidden className="size-3.5" />
                        {account.base_image_path ? "Fundo ok" : "Sem fundo"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ImageIcon aria-hidden className="size-3.5" />
                        {account.text_card_template_path ? "Template ok" : "Sem template"}
                      </span>
                      {expiresAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock aria-hidden className="size-3.5" />
                          Token até {expiresAt}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {account.is_active ? (
                        <Button
                          size="sm"
                          onClick={() => setCredentialsFor(account)}
                          disabled={isBusy}
                        >
                          <KeyRound className="size-4" />
                          {account.has_token ? "Trocar token" : "Token"}
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFormTarget({ mode: "edit", account })}
                        disabled={isBusy}
                      >
                        <Pencil className="size-4" />
                        Editar
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label="Mais ações"
                            disabled={isBusy}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onSelect={() => {
                              setFormTarget({ mode: "edit", account });
                            }}
                          >
                            <Pencil className="size-4" />
                            Editar e imagens
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setArchiveTarget(account);
                            }}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            {account.is_active ? (
                              <>
                                <Undo2 className="size-4" />
                                Arquivar conta
                              </>
                            ) : (
                              <>
                                <Undo2 className="size-4" />
                                Restaurar conta
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AccountFormDialog
        open={formTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
        account={formTarget?.mode === "edit" ? formTarget.account : null}
        isSubmitting={saveMutation.isPending}
        onSubmit={handleFormSubmit}
      />

      <CredentialsDialog
        open={credentialsFor !== null}
        onOpenChange={(open) => {
          if (!open) setCredentialsFor(null);
        }}
        account={credentialsFor}
        isSaving={credentialsMutation.isPending}
        onSave={(credentials) => {
          if (credentialsFor) {
            credentialsMutation.mutate({
              id: credentialsFor.id,
              credentials,
            });
          }
        }}
      />

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.is_active ? "Arquivar conta?" : "Restaurar conta?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.is_active ? (
                <>
                  A conta <strong>{archiveTarget?.display_name}</strong> sai da fila e
                  para de publicar. Posts, imagens e histórico continuam intactos.
                </>
              ) : (
                <>
                  A conta <strong>{archiveTarget?.display_name}</strong> volta a
                  aparecer na fila e a publicar novamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveTarget) {
                  archiveMutation.mutate({
                    id: archiveTarget.id,
                    archived: archiveTarget.is_active,
                  });
                }
              }}
            >
              {archiveTarget?.is_active ? "Arquivar" : "Restaurar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
