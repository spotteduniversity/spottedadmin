"use client";

/**
 * Criação e edição de contas.
 *
 * Reúne tudo o que configura uma cidade num único modal: nome, usuário do
 * Instagram, slug, cores do card e as duas imagens (fundo e template).
 * As imagens são escolhidas aqui, mas enviadas para `POST /:id/assets`,
 * que é multipart — por isso o submit entrega os arquivos junto e quem
 * orquestra (a página) decide a ordem: cria a conta e só então sobe o asset.
 *
 * As validações espelham as do backend em `PATCH /accounts/:id`, e as
 * cores podem ser ajustadas pelos seletores sem precisar digitar o hex.
 */

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Image as ImageIcon, Upload, X } from "lucide-react";
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
import {
  ASSET_MIME_TYPES,
  DEFAULT_SHADOW_COLOR,
  DEFAULT_TEXT_COLOR,
  MAX_ASSET_BYTES,
} from "@/lib/types";
import type { Account } from "@/lib/types";

const HEX = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9-]*$/;
// Regras de usuário do Instagram (o backend valida igual).
const USERNAME = /^[a-zA-Z0-9._]{1,30}$/;

const schema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Informe o nome da cidade.")
    .max(80, "Use no máximo 80 caracteres."),
  username: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .refine((value) => value === "" || USERNAME.test(value), {
      message: "Até 30 caracteres: letras, números, ponto e underscore.",
    }),
  slug: z
    .string()
    .trim()
    .regex(SLUG, "Use apenas letras minúsculas, números e hífen.")
    .optional(),
  text_color: z.string().regex(HEX, "Informe um hex de 6 dígitos."),
  shadow_r: z.number().int().min(0).max(255),
  shadow_g: z.number().int().min(0).max(255),
  shadow_b: z.number().int().min(0).max(255),
  shadow_alpha: z.number().min(0).max(1),
});

type FormValues = z.infer<typeof schema>;
type AssetKind = "base" | "template";

export interface AccountFormValues {
  display_name: string;
  username?: string;
  slug?: string;
  text_color: string;
  shadow_color: string;
  /** Arquivos escolhidos no modal, ainda não enviados. */
  assets: Partial<Record<AssetKind, File>>;
}

/** "rgba(0, 0, 0, 0.65)" -> partes numéricas. */
function parseShadow(value: string | null | undefined) {
  const fallback = { r: 0, g: 0, b: 0, alpha: 0.65 };
  if (!value) return fallback;
  const match = value.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (!match) return fallback;
  return {
    r: Number(match[1]) || 0,
    g: Number(match[2]) || 0,
    b: Number(match[3]) || 0,
    alpha: match[4] === undefined ? 1 : Number(match[4]),
  };
}

type ShadowParts = {
  shadow_r: number;
  shadow_g: number;
  shadow_b: number;
  shadow_alpha: number;
};

function toShadow({
  shadow_r,
  shadow_g,
  shadow_b,
  shadow_alpha,
}: ShadowParts): string {
  return `rgba(${shadow_r}, ${shadow_g}, ${shadow_b}, ${Number(shadow_alpha.toFixed(2))})`;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = criar; preenchido = editar. */
  account: Account | null;
  isSubmitting: boolean;
  onSubmit: (values: AccountFormValues) => void;
}) {
  const isEditing = Boolean(account);
  const shadow = parseShadow(account?.shadow_color);

  const [assets, setAssets] = useState<Partial<Record<AssetKind, File>>>({});
  const [assetError, setAssetError] = useState<string | null>(null);
  const inputs = useRef<Record<AssetKind, HTMLInputElement | null>>({
    base: null,
    template: null,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: "",
      username: "",
      slug: "",
      text_color: DEFAULT_TEXT_COLOR,
      shadow_r: shadow.r,
      shadow_g: shadow.g,
      shadow_b: shadow.b,
      shadow_alpha: shadow.alpha,
    },
  });

  // Reabrir o diálogo com outra conta recarrega todos os valores.
  useEffect(() => {
    if (!open) return;
    const next = parseShadow(account?.shadow_color);
    reset({
      display_name: account?.display_name ?? "",
      username: account?.username ?? "",
      slug: account?.slug ?? "",
      text_color: account?.text_color ?? DEFAULT_TEXT_COLOR,
      shadow_r: next.r,
      shadow_g: next.g,
      shadow_b: next.b,
      shadow_alpha: next.alpha,
    });
    setAssets({});
    setAssetError(null);
  }, [open, account, reset]);

  // Só os valores que alimentam os seletores de cor precisam de re-render.
  const [textColor, r, g, b] = watch([
    "text_color",
    "shadow_r",
    "shadow_g",
    "shadow_b",
  ]);

  const safeColor = HEX.test(textColor) ? textColor : DEFAULT_TEXT_COLOR;

  function pickFile(kind: AssetKind) {
    setAssetError(null);
    inputs.current[kind]?.click();
  }

  function onFileChange(kind: AssetKind, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite reescolher o mesmo arquivo logo em seguida.
    event.target.value = "";
    if (!file) return;

    if (!ASSET_MIME_TYPES.includes(file.type as (typeof ASSET_MIME_TYPES)[number])) {
      setAssetError("Formato aceito: PNG ou JPEG.");
      return;
    }
    if (file.size > MAX_ASSET_BYTES) {
      setAssetError("Arquivo acima de 8 MB.");
      return;
    }

    setAssets((current) => ({ ...current, [kind]: file }));
  }

  function clearFile(kind: AssetKind) {
    setAssets((current) => {
      const next = { ...current };
      delete next[kind];
      return next;
    });
  }

  function submit(values: FormValues) {
    onSubmit({
      display_name: values.display_name.trim(),
      username: values.username || undefined,
      slug: values.slug?.trim(),
      text_color: values.text_color,
      shadow_color: toShadow(values),
      assets,
    });
  }

  const slots: Array<{
    kind: AssetKind;
    label: string;
    hint: string;
    currentPath: string | null;
  }> = [
    {
      kind: "template",
      label: "Template do card",
      hint: "Arte onde o texto é escrito. Vira o primeiro slide do post.",
      currentPath: account?.text_card_template_path ?? null,
    },
    {
      kind: "base",
      label: "Foto de encerramento",
      hint: "Publicada sozinha como último slide do carrossel. Não recebe texto.",
      currentPath: account?.base_image_path ?? null,
    },
  ];

  const hasPendingAssets = Object.keys(assets).length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar cidade" : "Nova cidade"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Tudo que afeta a publicação fica aqui. As imagens vão para o bucket da conta."
              : "A conta nasce desconectada; você pode subir as imagens já na criação."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="display_name">Nome da cidade</Label>
            <Input
              id="display_name"
              placeholder="Ex.: Campinas"
              aria-invalid={Boolean(errors.display_name)}
              {...register("display_name")}
            />
            {errors.display_name ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.display_name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Usuário do Instagram</Label>
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="shrink-0 text-sm text-muted-foreground">
                @
              </span>
              <Input
                id="username"
                placeholder="spotted_campinas"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.username)}
                {...register("username")}
              />
            </div>
            {errors.username ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.username.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? "Aparece na legenda do post. Conectar o Instagram redefine este valor."
                  : "Opcional. Sem ele, usamos um placeholder até a conexão."}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              Slug{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="slug"
              placeholder="ex.: campinas"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={Boolean(errors.slug)}
              {...register("slug")}
            />
            {errors.slug ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.slug.message}
              </p>
            ) : null}
          </div>

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Imagens</legend>

            <div className="space-y-2">
              {slots.map((slot) => {
                const selected = assets[slot.kind];
                return (
                  <div
                    key={slot.kind}
                    className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <ImageIcon aria-hidden className="size-4 text-muted-foreground" />
                        {slot.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{slot.hint}</p>
                      {selected ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs">
                          <span aria-hidden className="status-dot" />
                          <span className="truncate">{selected.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            ({(selected.size / 1024).toFixed(0)} KB)
                          </span>
                        </p>
                      ) : slot.currentPath ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs">
                          <span aria-hidden className="status-dot" />
                          <span className="truncate text-muted-foreground">
                            {slot.currentPath}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span aria-hidden className="status-dot-muted" />
                          Nenhum arquivo enviado
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        ref={(node) => {
                          inputs.current[slot.kind] = node;
                        }}
                        type="file"
                        accept={ASSET_MIME_TYPES.join(",")}
                        className="sr-only"
                        onChange={(event) => onFileChange(slot.kind, event)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => pickFile(slot.kind)}
                      >
                        <Upload className="size-4" />
                        {selected ? "Trocar" : "Enviar"}
                      </Button>
                      {selected ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Descartar ${slot.label}`}
                          disabled={isSubmitting}
                          onClick={() => clearFile(slot.kind)}
                        >
                          <X className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {assetError ? (
              <p role="alert" className="text-xs text-destructive">
                {assetError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">PNG ou JPEG, até 8 MB.</p>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Aparência do card</legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="text_color">Cor do texto</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="text_color_picker"
                    type="color"
                    aria-label="Seletor de cor do texto"
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                    value={safeColor}
                    onChange={(event) =>
                      // Mantém o hex sincronizado entre picker e campo.
                      setValue("text_color", event.target.value, {
                        shouldValidate: true,
                      })
                    }
                  />
                  <Input
                    id="text_color"
                    className="font-mono uppercase"
                    aria-invalid={Boolean(errors.text_color)}
                    {...register("text_color")}
                  />
                </div>
                {errors.text_color ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.text_color.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="shadow_alpha">Sombra</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="shadow_picker"
                    type="color"
                    aria-label="Seletor de cor da sombra"
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                    value={`#${[r, g, b]
                      .map((channel) =>
                        (Number(channel) || 0).toString(16).padStart(2, "0"),
                      )
                      .join("")}`}
                    onChange={(event) => {
                      const hex = event.target.value.slice(1);
                      setValue("shadow_r", parseInt(hex.slice(0, 2), 16));
                      setValue("shadow_g", parseInt(hex.slice(2, 4), 16));
                      setValue("shadow_b", parseInt(hex.slice(4, 6), 16));
                    }}
                  />
                  <Input
                    id="shadow_alpha"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    className="font-mono"
                    {...register("shadow_alpha", { valueAsNumber: true })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Opacidade de 0 a 1.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(["r", "g", "b"] as const).map((channel) => (
                <div key={channel} className="space-y-2">
                  <Label htmlFor={`shadow_${channel}`} className="uppercase">
                    {channel}
                  </Label>
                  <Input
                    id={`shadow_${channel}`}
                    type="number"
                    min={0}
                    max={255}
                    className="font-mono"
                    {...register(`shadow_${channel}`, { valueAsNumber: true })}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner className="size-4" /> : null}
              {isSubmitting && hasPendingAssets
                ? "Enviando imagens…"
                : isEditing
                  ? "Salvar alterações"
                  : "Criar cidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_SHADOW_COLOR };
