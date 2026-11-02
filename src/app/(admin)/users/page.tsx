"use client";

/**
 * Administradores.
 *
 * Área restrita a super-admins: a tabela `admins` concede poder sobre todas
 * as contas, então só quem é super pode ampliar escopos. O backend recusa
 * autoexclusão, auto-rebaixamento e a remoção do último super-admin; aqui
 * deixamos essas ações indisponíveis na interface.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, ShieldCheck, Trash2, UserRound } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage, useAuth, useAuthGuard } from "@/lib/auth-context";
import { createAdmin, deleteAdmin, fetchAccounts, fetchAdmins, qk, updateAdmin } from "@/lib/api";
import type { Account, AdminUser } from "@/lib/types";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export default function UsersPage() {
  const { ready } = useAuthGuard({ requireSuper: true });
  const { admin: currentAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  // Campos do formulário, controlados manualmente por causa dos condicionais.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const admins = useQuery({
    queryKey: qk.admins,
    queryFn: fetchAdmins,
    enabled: ready,
  });

  const accounts = useQuery({
    queryKey: qk.accounts(false),
    queryFn: () => fetchAccounts(false),
    enabled: ready,
  });

  function openCreate() {
    setEditing(null);
    setUsername("");
    setPassword("");
    setIsSuper(false);
    setAccountIds([]);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(admin: AdminUser) {
    setEditing(admin);
    setUsername(admin.username);
    setPassword("");
    setIsSuper(admin.is_super);
    setAccountIds(admin.account_ids ?? []);
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateAdmin(editing.id, {
          username: username.trim(),
          // Senha vazia mantém a atual.
          password: password.length > 0 ? password : undefined,
          is_super: isSuper,
          accountIds: isSuper ? [] : accountIds,
        });
      }
      return createAdmin({
        username: username.trim(),
        password,
        is_super: isSuper,
        accountIds: isSuper ? [] : accountIds,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Administrador atualizado." : "Administrador criado.");
      setFormOpen(false);
      // A lista é a fonte da verdade: create/update não devolvem account_ids.
      void queryClient.invalidateQueries({ queryKey: qk.admins });
    },
    onError: (error) => {
      const message = errorMessage(error, "Falha ao salvar o administrador.");
      setFormError(message);
      toast.error(message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: deleteAdmin,
    onSuccess: () => {
      toast.success("Administrador removido.");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: qk.admins });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Falha ao remover o administrador."));
      setDeleteTarget(null);
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return admins.data ?? [];
    return (admins.data ?? []).filter((admin) =>
      admin.username.toLowerCase().includes(term),
    );
  }, [admins.data, search]);

  function toggleAccount(id: string) {
    setAccountIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function submitForm() {
    setFormError(null);
    if (!username.trim()) {
      setFormError("Informe o usuário.");
      return;
    }
    if (!editing && password.length < 8) {
      setFormError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (editing && password.length > 0 && password.length < 8) {
      setFormError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (!isSuper && accountIds.length === 0) {
      setFormError("Selecione ao menos uma cidade para o admin comum.");
      return;
    }
    saveMutation.mutate();
  }

  if (!ready) {
    return (
      <PageBody>
        <div
          role="status"
          className="grid min-h-64 place-items-center"
        >
          <Spinner className="size-6" />
          <span className="sr-only">Carregando administradores…</span>
        </div>
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Administradores"
        description="Contas com acesso ao painel e às cidades vinculadas."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo administrador
          </Button>
        }
      />

      <Card>
        <CardContent>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Label htmlFor="busca-admins" className="sr-only">
              Buscar administradores
            </Label>
            <Input
              id="busca-admins"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por usuário…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {admins.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <CardContent className="space-y-3 py-5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : admins.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">
              {errorMessage(admins.error, "Falha ao carregar os administradores.")}
            </p>
            <Button variant="outline" onClick={() => admins.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {search.trim() ? "Nenhum administrador encontrado." : "Nenhum administrador."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((admin) => {
            const isSelf = admin.id === currentAdmin?.id;
            return (
              <li key={admin.id}>
                <Card>
                  <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                      >
                        {admin.is_super ? (
                          <ShieldCheck className="size-5" />
                        ) : (
                          <UserRound className="size-5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          <span className="truncate">{admin.username}</span>
                          {admin.is_super ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                              <span aria-hidden className="status-dot" />
                              Super-admin
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {admin.account_ids?.length ?? 0}{" "}
                              {(admin.account_ids?.length ?? 0) === 1 ? "cidade" : "cidades"}
                            </span>
                          )}
                          {isSelf ? (
                            <span className="text-xs text-muted-foreground">(você)</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Criado em {formatDate(admin.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(admin)}
                        disabled={saveMutation.isPending}
                      >
                        <Pencil className="size-4" />
                        Editar
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        aria-label={`Remover ${admin.username}`}
                        // O backend bloqueia autoexclusão; escondemos o botão.
                        disabled={isSelf || removeMutation.isPending}
                        title={isSelf ? "Você não pode remover o próprio usuário." : undefined}
                        onClick={() => setDeleteTarget(admin)}
                        className="relative touch-target text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !saveMutation.isPending) setFormOpen(false);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar administrador" : "Novo administrador"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Deixe a senha em branco para mantê-la."
                : "A senha precisa ter ao menos 8 caracteres."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(formError)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {editing ? "Nova senha" : "Senha"}{" "}
                {editing ? (
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                ) : null}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <Label htmlFor="is_super" className="cursor-pointer">
                  Super-admin
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Acesso a todas as cidades e à gestão de administradores.
                </p>
              </div>
              <Switch
                id="is_super"
                checked={isSuper}
                onCheckedChange={setIsSuper}
                // Rebaixar a si mesmo deixaria o sistema sem super.
                disabled={editing?.id === currentAdmin?.id}
              />
            </div>

            {!isSuper ? (
              <fieldset className="space-y-3 rounded-lg border p-4">
                <legend className="px-1 text-sm font-medium">Cidades permitidas</legend>

                {accounts.isPending ? (
                  <div className="space-y-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : (accounts.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conta ativa para vincular.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {(accounts.data ?? []).map((account: Account) => {
                      const checked = accountIds.includes(account.id);
                      return (
                        <label
                          key={account.id}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleAccount(account.id)}
                            aria-label={account.display_name ?? account.username}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {account.display_name || account.username}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            @{account.username}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            ) : null}

            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={submitForm} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Spinner className="size-4" /> : null}
              {editing ? "Salvar alterações" : "Criar administrador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso de <strong>{deleteTarget?.username}</strong> será removido
              permanentemente, junto com as vinculações de cidades. O sistema
              sempre precisa de ao menos um super-admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) removeMutation.mutate(deleteTarget.id);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
