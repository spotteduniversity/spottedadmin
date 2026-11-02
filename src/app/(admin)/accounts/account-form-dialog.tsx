"use client";

/**
 * Criação e edição de contas.
 *
 * Reúne tudo o que configura uma cidade num único modal: nome, usuário do
 * Instagram, slug, cores do card e as imagens (logo, template e fundo).
 * As imagens são escolhidas aqui, mas enviadas para as rotas de assets,
 * que são multipart — por isso o submit entrega os arquivos junto e quem
 * orquestra (a página) decide a ordem: cria a conta e só então sobe o asset.
 */

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Image as ImageIcon,
  Palette,
  Send,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  ASSET_MIME_TYPES,
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
  is_moderated: z.boolean(),
  text_color: z.string().regex(HEX, "Informe um hex de 6 dígitos."),
  shadow_r: z.number().int().min(0).max(255),
  shadow_g: z.number().int().min(0).max(255),
  shadow_b: z.number().int().min(0).max(255),
  shadow_alpha: z.number().min(0).max(1),
});

type FormValues = z.infer<typeof schema>;
type AssetKind = "base" | "template" | "logo";

export interface AccountFormValues {
  display_name: string;
  username?: string;
  slug?: string;
  is_moderated: boolean;
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
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  return {
    r: Number(match[1]) || 0,
    g: Number(match[2]) || 0,
    b: Number(match[3]) || 0,
    alpha: Number.isFinite(alpha) ? alpha : fallback.alpha,
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

function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
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
    logo: null,
  });
  // Evita que um refetch da lista, com um novo objeto de conta, apague o que
  // o usuário digitou enquanto o modal está aberto.
  const loadedFor = useRef<string | null>(null);

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
      is_moderated: true,
      text_color: DEFAULT_TEXT_COLOR,
      shadow_r: shadow.r,
      shadow_g: shadow.g,
      shadow_b: shadow.b,
      shadow_alpha: shadow.alpha,
    },
  });

  // Reabrir o diálogo com outra conta recarrega todos os valores.
  useEffect(() => {
    if (!open) {
      loadedFor.current = null;
      return;
    }
    const key = account?.id ?? "new";
    if (loadedFor.current === key) return;
    loadedFor.current = key;

    const next = parseShadow(account?.shadow_color);
    reset({
      display_name: account?.display_name ?? "",
      username: account?.username ?? "",
      slug: account?.slug ?? "",
      is_moderated: account?.is_moderated ?? true,
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
  const [textColor, r, g, b, alpha] = watch([
    "text_color",
    "shadow_r",
    "shadow_g",
    "shadow_b",
    "shadow_alpha",
  ]);
  const isModerated = watch("is_moderated");

  const safeColor = HEX.test(textColor) ? textColor : DEFAULT_TEXT_COLOR;
  const shadowPreview = `rgba(${Number(r) || 0}, ${Number(g) || 0}, ${
    Number(b) || 0
  }, ${Number(alpha) || 0})`;

  function pickFile(kind: AssetKind) {
    setAssetError(null);
    inputs.current[kind]?.click();
  }

  function onFileChange(
    kind: AssetKind,
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    // Permite reescolher o mesmo arquivo logo em seguida.
    event.target.value = "";
    if (!file) return;

    if (
      !ASSET_MIME_TYPES.includes(file.type as (typeof ASSET_MIME_TYPES)[number])
    ) {
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
    if (isSubmitting) return;
    onSubmit({
      display_name: values.display_name.trim(),
      username: values.username || undefined,
      slug: values.slug?.trim(),
      is_moderated: values.is_moderated,
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
      kind: "logo",
      label: "Logo da cidade",
      hint: "Aparece no topo da página pública.",
      currentPath: account?.spotted_logo ?? null,
    },
    {
      kind: "template",
      label: "Template do card",
      hint: "Arte onde o texto do spotted é escrito.",
      currentPath: account?.text_card_template_path ?? null,
    },
    {
      kind: "base",
      label: "Foto de encerramento",
      hint: "Último slide do carrossel, sem texto.",
      currentPath: account?.base_image_path ?? null,
    },
  ];

  const pendingAssetCount = Object.keys(assets).length;
  const hasPendingAssets = pendingAssetCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b bg-muted/20 px-6 py-5 text-left">
          <div className="flex items-start gap-3 pr-8">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border bg-background">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-lg">
                {isEditing
                  ? account?.display_name || "Editar cidade"
                  : "Nova cidade"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isEditing
                  ? "Atualize os dados, a publicação e as imagens desta cidade."
                  : "A conta nasce desconectada; você pode configurar tudo agora."}
              </DialogDescription>
            </div>
          </div>

          {isEditing ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 pl-[52px]">
              <Badge variant="outline">@{account?.username}</Badge>
              {account?.slug ? (
                <Badge variant="outline">/{account.slug}</Badge>
              ) : null}
              {account?.is_moderated === false ? (
                <Badge variant="secondary">Publicação automática</Badge>
              ) : null}
            </div>
          ) : null}
        </DialogHeader>

        <form
          onSubmit={handleSubmit(submit)}
          noValidate
          className="flex min-h-0 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <FormSection
              icon={<Building2 className="size-4" />}
              title="Identificação"
              description="Nome, usuário e endereço da cidade no painel."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
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
                    <span
                      aria-hidden
                      className="shrink-0 text-sm text-muted-foreground"
                    >
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
                        ? "Aparece na legenda. Conectar o Instagram redefine este valor."
                        : "Opcional. Sem ele, usamos um placeholder até a conexão."}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Slug{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
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
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Endereço público da cidade.
                    </p>
                  )}
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={<Send className="size-4" />}
              title="Publicação"
              description="Defina se os spotteds passam por revisão antes de ir ao Instagram."
            >
              <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label
                      htmlFor="is_moderated"
                      className="text-sm font-medium"
                    >
                      Revisar antes de publicar
                    </Label>
                    <Badge variant={isModerated ? "secondary" : "outline"}>
                      {isModerated ? "Manual" : "Automática"}
                    </Badge>
                  </div>
                  <p className="max-w-xl text-xs text-muted-foreground">
                    {isModerated
                      ? "Todo spotted fica pendente até a aprovação no painel."
                      : "Os spotteds são publicados automaticamente. Se a publicação falhar, ficam pendentes."}
                  </p>
                </div>
                <Switch
                  id="is_moderated"
                  checked={isModerated}
                  onCheckedChange={(checked) =>
                    setValue("is_moderated", checked, { shouldValidate: true })
                  }
                  disabled={isSubmitting}
                  className="shrink-0"
                />
              </div>
            </FormSection>

            <FormSection
              icon={<Palette className="size-4" />}
              title="Aparência do card"
              description="Cores usadas no texto sobre a arte do template."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="text_color">Cor do texto</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="text_color_picker"
                      type="color"
                      aria-label="Seletor de cor do texto"
                      className="size-10 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                      value={safeColor}
                      onChange={(event) =>
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
                      className="size-10 shrink-0 cursor-pointer rounded-md border bg-background p-1"
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
                  <p className="text-xs text-muted-foreground">
                    Opacidade de 0 a 1.
                  </p>
                </div>

                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                  {(["r", "g", "b"] as const).map((channel) => (
                    <div key={channel} className="space-y-2">
                      <Label
                        htmlFor={`shadow_${channel}`}
                        className="uppercase"
                      >
                        {channel}
                      </Label>
                      <Input
                        id={`shadow_${channel}`}
                        type="number"
                        min={0}
                        max={255}
                        className="font-mono"
                        {...register(`shadow_${channel}`, {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Prévia</p>
                  <p
                    className="mt-1 text-lg font-semibold"
                    style={{
                      color: safeColor,
                      textShadow: `0 1px 2px ${shadowPreview}`,
                    }}
                  >
                    Assim o texto aparece no card.
                  </p>
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={<ImageIcon className="size-4" />}
              title="Imagens"
              description="Logo da cidade, template do card e foto de encerramento."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {slots.map((slot) => {
                  const selected = assets[slot.kind];
                  return (
                    <div
                      key={slot.kind}
                      className="flex flex-col rounded-lg border p-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{slot.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {slot.hint}
                        </p>
                      </div>

                      <div className="mt-3 flex min-h-24 flex-1 items-center justify-center rounded-md border border-dashed bg-muted/30 p-2">
                        {selected ? (
                          <div className="max-w-full text-center">
                            <ImageIcon className="mx-auto size-5 text-muted-foreground" />
                            <p className="mt-1 max-w-full truncate text-xs font-medium">
                              {selected.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {(selected.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                        ) : slot.currentPath ? (
                          slot.kind === "logo" ? (
                            <span
                              role="img"
                              aria-label="Logo atual"
                              className="block h-20 w-full rounded-md border bg-background bg-contain bg-center bg-no-repeat"
                              style={{
                                backgroundImage: `url("${slot.currentPath}")`,
                              }}
                            />
                          ) : (
                            <div className="max-w-full text-center">
                              <ImageIcon className="mx-auto size-5 text-muted-foreground" />
                              <p className="mt-1 line-clamp-2 max-w-full break-all text-[11px] text-muted-foreground">
                                {slot.currentPath}
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="text-center text-xs text-muted-foreground">
                            <ImageIcon className="mx-auto mb-1 size-5" />
                            Nenhum arquivo
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-1.5">
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
                          className="flex-1"
                          disabled={isSubmitting}
                          onClick={() => pickFile(slot.kind)}
                        >
                          <Upload className="size-4" />
                          {selected
                            ? "Trocar"
                            : slot.currentPath
                              ? "Substituir"
                              : "Enviar"}
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
                <p role="alert" className="mt-3 text-xs text-destructive">
                  {assetError}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  PNG ou JPEG, até 8 MB por arquivo.
                </p>
              )}
            </FormSection>
          </div>

          <div className="border-t bg-background px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {hasPendingAssets
                  ? `${pendingAssetCount} ${
                      pendingAssetCount === 1
                        ? "imagem será enviada"
                        : "imagens serão enviadas"
                    } ao salvar.`
                  : "As imagens são enviadas depois de salvar a cidade."}
              </p>
              <div className="flex justify-end gap-2">
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
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
