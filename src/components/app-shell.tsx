"use client";

/**
 * Estrutura do painel: navegação lateral + área de conteúdo.
 *
 * O `Sidebar` do shadcn já vira Sheet no mobile, então o mesmo markup
 * cobre desktop e celular.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, KeyRound, LayoutList, LogOut, ShieldCheck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutList;
  superOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/pending", label: "Fila de aprovação", icon: LayoutList },
  { href: "/accounts", label: "Contas e cidades", icon: Building2 },
  { href: "/long-lived-token", label: "Criar Long Lived", icon: KeyRound },
  { href: "/users", label: "Administradores", icon: ShieldCheck, superOnly: true },
];

function Brand() {
  return (
    <Link
      href="/pending"
      className="flex items-center gap-2.5 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-sm font-bold text-background"
      >
        S
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">Spotted</span>
        <span className="mt-1 text-[11px] font-medium text-muted-foreground">
          Painel admin
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, isSuper, logout } = useAuth();

  const items = NAV_ITEMS.filter((item) => !item.superOnly || isSuper);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Brand />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Painel</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <Separator className="mb-2" />
          <div className="flex flex-col gap-2 px-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium text-foreground">
              {admin?.username}
            </span>
            <span>{isSuper ? "Super-admin" : "Admin"}</span>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={logout}
                tooltip="Sair"
                className="hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="text-muted-foreground" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 pt-[env(safe-area-inset-top)] h-[calc(3.5rem+env(safe-area-inset-top))] backdrop-blur-sm md:hidden">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-semibold">Spotted</span>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Cabeçalho de página reutilizável (título, descrição e ações). */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Container padrão das telas. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

/** Botão de retorno ao topo, só no mobile. */
export function BackToTop() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="md:hidden"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      Voltar ao topo
    </Button>
  );
}
