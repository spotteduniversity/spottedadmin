"use client";

/**
 * Credenciais de publicação de uma conta do Instagram.
 *
 * Não existe fluxo de "conectar": o sistema não tem OAuth, nem app da Meta
 * configurado, nem job de renovação. O admin cola duas coisas e pronto:
 *
 *   - access token de longa duração, gerado no Graph API Explorer
 *   - IG User ID, o número que aparece na URL de toda chamada de publicação
 *     (ex.: 17841405822304914). O mesmo número aparece em
 *     `https://www.instagram.com/{username}` -> abrir as devs tools, ou em
 *     qualquer URL de post.
 *
 * O backend valida o par contra a Meta antes de gravar, e aproveita a resposta
 * para corrigir o `@username` da conta — então não adianta tentar acertar o
 * nome de usuário aqui.
 *
 * Trocar o token é colar um novo. O antigo é sobrescrito.
 */

import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { Account } from "@/lib/types";
import type { AccountCredentials } from "@/lib/api";

/** Mesmo piso do backend, que rejeita tokens com formato obviamente errado. */
const MIN_TOKEN_LENGTH = 20;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

/** Mesmo regex do backend: só dígitos, 5 a 30. */
const IG_USER_ID_RE = /^\d{5,30}$/;

export function CredentialsDialog({
  open,
  onOpenChange,
  account,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  isSaving: boolean;
  onSave: (credentials: AccountCredentials) => void;
}) {
  if (!account) return null;

  // A key remonta o formulário a cada conta, então o token digitado nunca
  // sobrevive de uma conta para outra. Evita sincronizar estado em efeito.
  return (
    <CredentialsForm
      key={account.id}
      open={open}
      onOpenChange={onOpenChange}
      account={account}
      isSaving={isSaving}
      onSave={onSave}
    />
  );
}

function CredentialsForm({
  open,
  onOpenChange,
  account,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account;
  isSaving: boolean;
  onSave: (credentials: AccountCredentials) => void;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [igUserId, setIgUserId] = useState(
    IG_USER_ID_RE.test(account.ig_user_id) ? account.ig_user_id : "",
  );
  const [showToken, setShowToken] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const hasToken = account.has_token === true;
  const savedAt = formatDate(account.token_refreshed_at);
  const tokenIsValid = accessToken.trim().length >= MIN_TOKEN_LENGTH;
  const igUserIdIsValid = IG_USER_ID_RE.test(igUserId.trim());
  const canSubmit = tokenIsValid && igUserIdIsValid && !isSaving;

  function save() {
    if (!canSubmit) {
      setLocalError(
        !igUserIdIsValid
          ? "O IG User ID precisa ser só números."
          : "O access token parece curto demais.",
      );
      return;
    }
    setLocalError(null);
    onSave({ access_token: accessToken.trim(), ig_user_id: igUserId.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-lg:sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Credenciais de publicação</DialogTitle>
          <DialogDescription>
            {account.display_name || account.username} — token e IG User ID da conta
            que publica os posts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Estado atual */}
          <div className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <span
              aria-hidden
              className={`mt-1.5 size-2 shrink-0 rounded-full ${
                hasToken ? "bg-accent" : "bg-muted-foreground"
              }`}
            />
            <div>
              <p className="font-medium">
                {hasToken ? "Token configurado" : "Nenhum token configurado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasToken ? (
                  <>
                    {account.ig_user_id
                      ? `IG User ID ${account.ig_user_id}. `
                      : ""}
                    {savedAt ? `Colado em ${savedAt}. ` : ""}
                    Não renova sozinho: quando expirar, cole um novo aqui.
                  </>
                ) : (
                  <>Sem token a conta não publica nada no Instagram.</>
                )}
              </p>
              {account.last_error ? (
                <p className="mt-1 text-xs text-destructive">
                  Último erro: {account.last_error}
                </p>
              ) : null}
            </div>
          </div>

          {/* IG User ID */}
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">IG User ID</legend>

            <div className="space-y-2">
              <Label htmlFor="ig_user_id">Número da conta no Instagram</Label>
              <Input
                id="ig_user_id"
                type="text"
                inputMode="numeric"
                value={igUserId}
                onChange={(event) => {
                  setIgUserId(event.target.value.replace(/\D/g, ""));
                  setLocalError(null);
                }}
                placeholder="17841405822304914"
                autoComplete="off"
                className="font-mono"
                aria-invalid={igUserId.length > 0 && !igUserIdIsValid}
              />
              <p className="text-xs text-muted-foreground">
                É o número que a Meta usa na URL de toda publicação. Abra a conta
                no Instagram, copie o link e veja o número no fim — é esse.
              </p>
            </div>
          </fieldset>

          {/* Access token */}
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Access token</legend>

            <div className="space-y-2">
              <Label htmlFor="access_token">Token de longa duração</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="access_token"
                  type={showToken ? "text" : "password"}
                  value={accessToken}
                  onChange={(event) => {
                    setAccessToken(event.target.value);
                    setLocalError(null);
                  }}
                  placeholder="EAAB…"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  aria-invalid={Boolean(localError)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                  onClick={() => setShowToken((value) => !value)}
                >
                  {showToken ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
              {localError ? (
                <p role="alert" className="text-xs text-destructive">
                  {localError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Gere no Graph API Explorer com os escopos{" "}
                  <code>instagram_basic</code>,{" "}
                  <code>instagram_content_publish</code> e{" "}
                  <code>instagram_manage_insights</code>. Vale 60 dias.
                </p>
              )}
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <Button type="button" onClick={save} disabled={!canSubmit}>
            {isSaving ? <Spinner className="size-4" /> : <KeyRound className="size-4" />}
            {isSaving
              ? "Validando com a Meta…"
              : hasToken
                ? "Substituir token"
                : "Salvar credenciais"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
