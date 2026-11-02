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
import { AlertTriangle, MapPin, Plus, RefreshCw, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
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
  uploadAccountLogo,
} from "@/lib/api";
import { type Account } from "@/lib/types";
import {
  AccountFormDialog,
  type AccountFormValues,
} from "./account-form-dialog";
import { AccountList } from "./account-list";
import { CredentialsDialog } from "./credentials-dialog";

type FormTarget = { mode: "create" } | { mode: "edit"; account: Account };
type AssetKind = "base" | "template" | "logo";

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
          // Antes da migração a coluna não existe na resposta; não a envia.
          ...(target.is_moderated !== undefined
            ? { is_moderated: values.is_moderated }
            : {}),
        });
      } else {
        target = await createAccount({
          display_name: values.display_name,
          username: values.username,
          // Só envia quando falso; o default do banco já é `true`.
          ...(values.is_moderated === false ? { is_moderated: false } : {}),
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

      const entries = Object.entries(values.assets) as Array<
        [AssetKind, File | undefined]
      >;
      for (const [kind, file] of entries) {
        if (!file) continue;
        // O logo usa uma rota própria (`/logo`); base/template vão para `/assets`.
        target =
          kind === "logo"
            ? await uploadAccountLogo(target.id, file)
            : await uploadAccountAsset(target.id, kind, file);
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
        toast.success(
          `${uploaded} ${uploaded === 1 ? "imagem enviada" : "imagens enviadas"}.`,
        );
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
      toast.success(
        account.is_active ? "Conta restaurada." : "Conta arquivada.",
      );
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

  const moderationMutation = useMutation({
    mutationFn: ({ id, isModerated }: { id: string; isModerated: boolean }) =>
      patchAccount(id, { is_moderated: isModerated }),
    onMutate: async ({ id, isModerated }) => {
      const key = qk.accounts(includeArchived);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Account[]>(key);
      queryClient.setQueryData<Account[]>(key, (current) =>
        current?.map((account) =>
          account.id === id
            ? { ...account, is_moderated: isModerated }
            : account,
        ),
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          qk.accounts(includeArchived),
          context.previous,
        );
      }
      toast.error(errorMessage(error, "Falha ao alterar a moderação."));
    },
    onSuccess: (_account, { isModerated }) => {
      toast.success(
        isModerated
          ? "Conta volta a exigir aprovação."
          : "Publicação automática ativada.",
      );
    },
    onSettled: () => invalidateAccounts(),
  });

  const isBusy = saveMutation.isPending || archiveMutation.isPending;
  const moderatingId = moderationMutation.isPending
    ? (moderationMutation.variables?.id ?? null)
    : null;

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

      <Card className="py-0">
        <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <Badge
              variant="outline"
              className="shrink-0 font-normal text-muted-foreground"
            >
              {filtered.length} {filtered.length === 1 ? "cidade" : "cidades"}
              {search.trim() ? ` de ${accounts.data?.length ?? 0}` : ""}
            </Badge>

            <div className="flex items-center gap-2.5">
              <Label
                htmlFor="arquivadas"
                className="text-sm text-muted-foreground"
              >
                Mostrar arquivadas
              </Label>
              <Switch
                id="arquivadas"
                checked={includeArchived}
                onCheckedChange={setIncludeArchived}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {accounts.isPending ? (
        <Card className="overflow-hidden py-0">
          <div className="divide-y">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="hidden h-5 w-24 sm:block" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="hidden h-8 w-24 lg:block" />
              </div>
            ))}
          </div>
        </Card>
      ) : accounts.isError ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertTriangle />
              </EmptyMedia>
              <EmptyTitle>Não foi possível carregar as cidades</EmptyTitle>
              <EmptyDescription>
                {errorMessage(accounts.error, "Falha ao carregar as contas.")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => accounts.refetch()}>
                Tentar novamente
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPin />
              </EmptyMedia>
              <EmptyTitle>
                {search.trim()
                  ? "Nenhuma conta encontrada"
                  : "Nenhuma conta cadastrada"}
              </EmptyTitle>
              <EmptyDescription>
                {search.trim()
                  ? "Tente outro termo de busca."
                  : "Crie a primeira conta e depois conecte o Instagram."}
              </EmptyDescription>
            </EmptyHeader>
            {!search.trim() ? (
              <EmptyContent>
                <Button
                  size="sm"
                  onClick={() => setFormTarget({ mode: "create" })}
                >
                  <Plus className="size-4" />
                  Nova conta
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        </Card>
      ) : (
        <AccountList
          accounts={filtered}
          isBusy={isBusy}
          moderatingId={moderatingId}
          onModerate={(account, isModerated) =>
            moderationMutation.mutate({ id: account.id, isModerated })
          }
          onEdit={(account) => setFormTarget({ mode: "edit", account })}
          onCredentials={setCredentialsFor}
          onArchive={setArchiveTarget}
        />
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
              {archiveTarget?.is_active
                ? "Arquivar conta?"
                : "Restaurar conta?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.is_active ? (
                <>
                  A conta <strong>{archiveTarget?.display_name}</strong> sai da
                  fila e para de publicar. Posts, imagens e histórico continuam
                  intactos.
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
