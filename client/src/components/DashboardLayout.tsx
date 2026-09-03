import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import React, { useEffect } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  CalendarRange,
  FileSpreadsheet,
  Mail,
  LayoutDashboard,
  Link2,
  LogOut,
  KeyRound,
  PanelLeft,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/" },
  { icon: CalendarDays, label: "Planejamento", path: "/planejamento" },
  { icon: CalendarRange, label: "Calendário", path: "/calendario" },
  { icon: Users, label: "Equipe", path: "/equipe" },
  { icon: ShieldCheck, label: "Acessos", path: "/acessos" },
  { icon: ShieldAlert, label: "Restrições", path: "/restricoes" },
  { icon: AlertTriangle, label: "Alertas", path: "/alertas" },
  { icon: Mail, label: "E-mails", path: "/notificacoes-email" },
  { icon: Link2, label: "Conciliação", path: "/reconciliacao" },
  { icon: BookOpenCheck, label: "Guia de uso", path: "/guia" },
  { icon: FileSpreadsheet, label: "Importação", path: "/importacao" },
];

const roleLabels = {
  user: "Consulta",
  planner: "Planejamento",
  approver: "Aprovação",
  admin: "Administração",
} as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) setLocation("/entrar");
  }, [loading, setLocation, user]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) return null;

  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find(item => item.path === location);
  const role = user?.role ?? "user";

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-[#294b40] bg-[#173f35] text-[#edf4e8]">
        <SidebarHeader className="h-[92px] justify-center border-b border-[#294b40] px-3">
          <div className="flex w-full items-center gap-3 px-1">
            <button
              onClick={toggleSidebar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#dae6d5] transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8d8a9]"
              aria-label="Recolher ou expandir navegação"
            >
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="font-display text-[1.45rem] leading-none text-white">Férias</p>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="bg-[#173f35] px-2 py-5">
          {!isCollapsed && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#91aa9b]">Central de gestão</p>}
          <SidebarMenu>
            {menuItems.map(item => {
              const isActive = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className="h-11 rounded-xl px-3 text-[#d6e4d4] hover:bg-white/10 hover:text-white data-[active=true]:bg-[#e8d8a9] data-[active=true]:text-[#173f35] data-[active=true]:hover:bg-[#e8d8a9]"
                  >
                    <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    <span className="font-medium">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>

          {!isCollapsed && (
            <div className="sidebar-info-card mx-2 mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <ShieldCheck className="h-4 w-4 text-[#e8d8a9]" aria-hidden="true" />
              <p className="mt-3 text-xs font-semibold text-white">Fonte única de dados</p>
              <p className="mt-1 text-xs leading-5 text-[#b6cbbd]">Planejamento, aprovações e histórico no mesmo ambiente.</p>
            </div>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-[#294b40] bg-[#173f35] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8d8a9] group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-9 w-9 shrink-0 border border-white/15 bg-[#294b40]">
                  <AvatarFallback className="bg-[#294b40] text-xs font-semibold text-[#f9f7ef]">{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-medium text-white">{user?.name || "Usuário"}</p>
                  <p className="mt-0.5 text-xs text-[#b6cbbd]">{roleLabels[role]}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuItem onClick={() => setLocation("/minha-conta")} className="cursor-pointer">
                <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                Segurança da conta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sair do sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-screen bg-[#f4f5f1]">
        {isMobile && (
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#dce1da] bg-[#f4f5f1]/95 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-xl border border-[#dce1da] bg-white text-[#173f35]" />
              <div>
                <p className="font-display text-xl leading-none text-[#173f35]">Férias</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#718078]">{activeMenuItem?.label ?? "Central de gestão"}</p>
              </div>
            </div>
            <span className="rounded-full bg-[#e6eee5] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#32604d]">{roleLabels[role]}</span>
          </header>
        )}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
