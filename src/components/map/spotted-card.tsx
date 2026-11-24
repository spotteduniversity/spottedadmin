"use client";

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SpottedMapAccount } from "@/mocks/spotteds-map";
import {
  ACCOUNT_STATUS_LABEL,
  formatAccountDate,
  formatCount,
  getAccountStatus,
  type SpottedAccountStatus,
} from "./map-utils";

export interface SpottedCardProps {
  account: SpottedMapAccount;
  onClose: () => void;
}

function StatusBadge({ status }: { status: SpottedAccountStatus }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <span aria-hidden className="status-dot" />
        {ACCOUNT_STATUS_LABEL[status]}
      </Badge>
    );
  }

  if (status === "needs_reauth") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-destructive/30 text-destructive"
      >
        <AlertTriangle aria-hidden className="size-3" />
        {ACCOUNT_STATUS_LABEL[status]}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <span aria-hidden className="status-dot-muted" />
      {ACCOUNT_STATUS_LABEL[status]}
    </Badge>
  );
}

interface MetricTileProps {
  label: string;
  value: string;
  hint?: string;
}

function MetricTile({ label, value, hint }: MetricTileProps) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p data-numeric className="mt-0.5 text-base font-semibold tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SpottedCard({ account, onClose }: SpottedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const status = getAccountStatus(account);

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true });
  }, [account.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (cardRef.current?.contains(target)) return;
      // Permite clicar diretamente em outro marcador, cluster ou controle do mapa
      // sem piscar o card antes de selecionar a próxima conta.
      if (
        target.closest(
          ".spotted-marker-icon, .spotted-cluster-icon, [data-map-control='true']",
        )
      ) {
        return;
      }
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose]);

  const instagramUrl = `https://instagram.com/${encodeURIComponent(account.username)}`;

  function handleDetailsClick() {
    // TODO: Navegar para a tela de detalhes da conta (/accounts/[id]) ou
    // abrir o painel detalhado quando a rota estiver implementada.
    toast.info(`Em breve: detalhes de ${account.displayName}.`);
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`spotted-card-title-${account.id}`}
      data-map-control="true"
      className="pointer-events-auto absolute inset-x-3 bottom-3 z-[450] md:inset-x-auto md:top-4 md:right-4 md:bottom-auto md:w-[360px]"
    >
      <Card className="max-h-[68dvh] gap-4 overflow-y-auto py-4 shadow-xl md:max-h-[calc(100dvh-11.5rem)]">
        <CardHeader className="gap-2 px-4 pb-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <CardTitle
                id={`spotted-card-title-${account.id}`}
                className="truncate text-base"
              >
                {account.displayName}
              </CardTitle>
              <p className="truncate text-xs text-muted-foreground">
                @{account.username}
              </p>
            </div>

            <Button
              ref={closeButtonRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Fechar detalhes da página"
              className="relative -mt-1 -mr-1 shrink-0 touch-target"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              {account.city}/{account.state}
            </span>
            <StatusBadge status={status} />
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-4 px-4">
          <div className="grid grid-cols-2 gap-2.5">
            <MetricTile
              label="Total de spotteds"
              value={formatCount(account.totalSpotteds)}
            />
            <MetricTile
              label="Publicados"
              value={formatCount(account.publishedSpotteds)}
              hint="Status PUBLISHED"
            />
            <MetricTile
              label="Alcance médio"
              value={formatCount(account.avgReach)}
              hint="Média por spotted"
            />
            <MetricTile
              label="Usuários"
              value={formatCount(account.totalUsers)}
              hint="Cadastrados na conta"
            />
          </div>

          <div className="rounded-lg border px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              Engajamento acumulado
            </p>
            <div
              data-numeric
              className="mt-2 grid grid-cols-3 gap-2 text-xs"
            >
              <div className="flex items-center gap-1.5">
                <Heart
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {formatCount(account.totalLikes)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Curtidas</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <MessageCircle
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {formatCount(account.totalComments)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Comentários
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Share2
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {formatCount(account.totalShares)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Compart.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays aria-hidden className="size-3.5 shrink-0" />
            <span>Conta criada em {formatAccountDate(account.createdAt)}</span>
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="sm" className="flex-1">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>Ver no Instagram</span>
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDetailsClick}
              className="flex-1"
            >
              Ver detalhes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
