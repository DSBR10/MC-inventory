"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Menu, ChevronRight } from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import SiteFooter from "@/components/layout/SiteFooter";
import UserMenu from "@/components/layout/UserMenu";
import BrandLogo from "@/components/layout/BrandLogo";

const AUTH_ROUTES = ["/login", "/auth"];

const PAGE_NAMES: Record<string, string> = {
  "/": "Inventario",
  "/dashboard": "Dashboard",
  "/monitoreo": "Monitoreo",
  "/servidores": "Servidores",
  "/backups": "Backups",
  "/comandos": "Comandos",
  "/billing": "Billing",
  "/auditoria": "Auditoría",
  "/profile": "Perfil",
  "/terminal": "Terminal",
};

function pageNameFor(pathname: string | null): string {
  if (!pathname) return "MC Inventory";
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname];
  if (pathname.startsWith("/auditoria/")) return "Detalle de auditoría";
  return "MC Inventory";
}

export default function ClientLayout({
  children
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();

  const isAuthPage =
    AUTH_ROUTES.some((route) =>
      pathname?.startsWith(route)
    );

  const [
    sidebarOpen,
    setSidebarOpen
  ] = useState(false);

  // En desktop el sidebar arranca abierto; en móvil cerrado.
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    setSidebarOpen(media.matches);
  }, []);

  const [
    routeLoading,
    setRouteLoading
  ] = useState(false);

  const [
    routeLoadingVisible,
    setRouteLoadingVisible
  ] = useState(false);

  // Overlay con retardo de entrada (evita flash en navegación instantánea)
  // y tope de seguridad para navegaciones lentas.
  useEffect(() => {
    if (!routeLoading) return;

    const showTimer = window.setTimeout(() => {
      setRouteLoadingVisible(true);
    }, 250);
    const hideTimer = window.setTimeout(() => {
      setRouteLoading(false);
      setRouteLoadingVisible(false);
    }, 4000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [pathname, routeLoading]);

  useEffect(() => {
    // Al completar la navegación se oculta de inmediato.
    setRouteLoading(false);
    setRouteLoadingVisible(false);
  }, [pathname]);

  const pageName = pageNameFor(pathname);

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bg-dark)] text-[var(--text-primary)]">
        <div className="min-h-0 flex-1">{children}</div>
        <SiteFooter />
      </div>
    );
  }

  return (

    <div className="min-h-screen overflow-hidden bg-[var(--bg-dark)] text-[var(--text-primary)] transition-colors">

      <Sidebar
        open={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        onNavigate={() =>
          setRouteLoading(true)
        }
      />

      {sidebarOpen && (
        <div
          data-audit-action="layout.sidebar.overlay.close"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
        />
      )}

      <div
        className={`
          transition-all
          duration-300
          ease-in-out
          min-h-screen
          flex
          flex-col
          ${sidebarOpen ? "lg:ml-[280px]" : "ml-0"}
        `}
      >

        <header
          className="
            sticky
            top-0
            z-30
            h-14
            border-b
            border-[var(--border)]
            bg-[var(--bg-dark)]/85
            backdrop-blur-xl
            px-4
            sm:px-6
            flex
            items-center
            justify-between
          "
        >

          <div className="flex items-center gap-3">

            <button
              type="button"
              data-audit-action="layout.sidebar.toggle"
              data-audit-label={sidebarOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
              onClick={() =>
                setSidebarOpen(!sidebarOpen)
              }
              className="
                w-8
                h-8
                rounded-lg
                flex
                items-center
                justify-center
                text-[var(--text-secondary)]
                hover:text-[var(--text-primary)]
                hover:bg-[var(--bg-hover)]
                transition-all
              "
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-1.5 text-sm">
              <BrandLogo size={22} />
              <ChevronRight size={14} className="text-[var(--text-secondary)]/50" />
              <span className="font-medium text-[var(--text-primary)]">{pageName}</span>
            </div>

          </div>

          <div className="flex items-center gap-4">
            <UserMenu />
          </div>

        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>

        <SiteFooter />

      </div>

      <RouteLoadingOverlay visible={routeLoadingVisible} />

    </div>

  );

}

function RouteLoadingOverlay({
  visible
}: {
  visible: boolean;
}) {

  return (

    <div
      className={`
        fixed
        inset-0
        z-[80]
        flex
        items-center
        justify-center
        bg-[var(--bg-dark)]/80
        backdrop-blur-xl
        transition-all
        duration-300
        ${visible
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
        }
      `}
    >

      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Cargando módulo
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Preparando datos...
            </p>
          </div>
        </div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--bg-hover)]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--primary)]" />
        </div>
      </div>

    </div>

  );

}
