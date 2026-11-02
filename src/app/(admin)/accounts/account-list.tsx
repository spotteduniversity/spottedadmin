"use client";

import {
  AlertTriangle,
  Archive,
  Check,
  KeyRound,
  Minus,
  MoreHorizontal,
  Pencil,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Account } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function initials(account: Account): string {
  const source = account.display_name || account.username || "?";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function AccountAvatar({ account }: { account: Account }) {
  if (account.spotted_logo) {
    return (
      <span
        role="img"
        aria-label={`Logo de ${account.display_name}`}
        className="size-9 shrink-0 rounded-lg border bg-background bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${account.spotted_logo}")` }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted text-xs font-semibold uppercase text-muted-foreground"
    >
      {initials(account)}
    </span>
  );
}

function ConnectionBadge({ account }: { account: Account }) {
  if (!account.is_active) {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        <span aria-hidden className="status-dot-muted" />
        Arquivada
      </Badge>
    );
  }

  if (account.connection_status === "ok" && !account.needs_reauth) {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span aria-hidden className="status-dot" />
        Conectada
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-destructive/30 text-destructive"
    >
      <AlertTriangle aria-hidden className="size-3" />
      Reconectar
    </Badge>
  );
}

function AssetIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${ok ? "enviado" : "pendente"}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        ok
          ? "border-border text-foreground"
          : "border-dashed text-muted-foreground",
      )}
    >
      {ok ? (
        <Check aria-hidden className="size-3" />
      ) : (
        <Minus aria-hidden className="size-3" />
      )}
      {label}
    </span>
  );
}

export interface AccountListProps {
  accounts: Account[];
  isBusy: boolean;
  moderatingId: string | null;
  onModerate: (account: Account, isModerated: boolean) => void;
  onEdit: (account: Account) => void;
  onCredentials: (account: Account) => void;
  onArchive: (account: Account) => void;
}

export function AccountList({
  accounts,
  isBusy,
  moderatingId,
  onModerate,
  onEdit,
  onCredentials,
  onArchive,
}: AccountListProps) {
  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[32%] pl-4">Cidade</TableHead>
            <TableHead className="hidden md:table-cell">Instagram</TableHead>
            <TableHead className="hidden sm:table-cell">Conexão</TableHead>
            <TableHead>Moderação</TableHead>
            <TableHead className="hidden lg:table-cell">Imagens</TableHead>
            <TableHead className="hidden xl:table-cell">Token</TableHead>
            <TableHead className="pr-4 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {accounts.map((account) => {
            const expiresAt = formatDate(account.token_expires_at);
            const moderationAvailable = account.is_moderated !== undefined;
            const isModerated = account.is_moderated !== false;
            const isModerating = moderatingId === account.id;

            return (
              <TableRow
                key={account.id}
                className={cn(!account.is_active && "opacity-70")}
              >
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <AccountAvatar account={account} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {account.display_name || "Sem nome"}
                        </span>
                        {!account.is_active ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-muted-foreground"
                          >
                            Arquivada
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {account.slug ? `/${account.slug}` : "sem slug"}
                        <span className="md:hidden">
                          {" "}
                          · @{account.username}
                        </span>
                      </p>
                      <div className="mt-1.5 sm:hidden">
                        <ConnectionBadge account={account} />
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  <span className="text-sm">@{account.username}</span>
                  {account.needs_reauth && account.is_active ? (
                    <p className="text-xs text-muted-foreground">
                      Token precisa ser renovado.
                    </p>
                  ) : null}
                </TableCell>

                <TableCell className="hidden sm:table-cell">
                  <ConnectionBadge account={account} />
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isModerated}
                      onCheckedChange={(checked) =>
                        onModerate(account, checked)
                      }
                      disabled={isBusy || isModerating || !moderationAvailable}
                      aria-label={`Revisar antes de publicar ${account.display_name}`}
                      title={
                        moderationAvailable
                          ? "Revisar antes de publicar"
                          : "Rode a migração is_moderated no banco"
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {!moderationAvailable
                        ? "Pendente"
                        : isModerated
                          ? "Manual"
                          : "Auto"}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="hidden lg:table-cell">
                  <div className="flex items-center gap-1.5">
                    <AssetIndicator
                      ok={Boolean(account.spotted_logo)}
                      label="Logo"
                    />
                    <AssetIndicator
                      ok={Boolean(account.text_card_template_path)}
                      label="Card"
                    />
                    <AssetIndicator
                      ok={Boolean(account.base_image_path)}
                      label="Fundo"
                    />
                  </div>
                </TableCell>

                <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                  {expiresAt ? `Até ${expiresAt}` : "—"}
                </TableCell>

                <TableCell className="pr-4">
                  <div className="flex items-center justify-end gap-1">
                    {account.is_active ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => onCredentials(account)}
                        disabled={isBusy}
                        aria-label="Credenciais do Instagram"
                        title="Credenciais do Instagram"
                      >
                        <KeyRound className="size-4" />
                      </Button>
                    ) : null}

                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onEdit(account)}
                      disabled={isBusy}
                      aria-label="Editar cidade"
                      title="Editar cidade"
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Mais ações"
                          disabled={isBusy}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onSelect={() => onEdit(account)}>
                          <Pencil className="size-4" />
                          Editar e imagens
                        </DropdownMenuItem>
                        {account.is_active ? (
                          <DropdownMenuItem
                            onSelect={() => onCredentials(account)}
                          >
                            <KeyRound className="size-4" />
                            {account.has_token
                              ? "Trocar token"
                              : "Conectar token"}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => onArchive(account)}
                          className={
                            account.is_active
                              ? "text-destructive focus:bg-destructive/10 focus:text-destructive"
                              : undefined
                          }
                        >
                          {account.is_active ? (
                            <>
                              <Archive className="size-4" />
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
