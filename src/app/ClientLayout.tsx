"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Menu } from "lucide-react";

import Sidebar from "@/components/layout/Sidebar";
import UserMenu from "@/components/layout/UserMenu";

const AUTH_ROUTES = ["/login", "/auth"];

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

  const [
    time,
    setTime
  ] = useState("");

  const [
    routeLoading,
    setRouteLoading
  ] = useState(false);

  useEffect(() => {

    const updateClock = () => {

      setTime(

        new Date().toLocaleTimeString(
          "es-CO",
          {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }

        )

      );

    };

    updateClock();

    const interval =
      setInterval(updateClock, 1000);

    return () =>
      clearInterval(interval);

  }, []);

  useEffect(() => {

    if (!routeLoading) return;

    const timeout =
      setTimeout(() => {
        setRouteLoading(false);
      }, 850);

    return () =>
      clearTimeout(timeout);

  }, [pathname, routeLoading]);

  if (isAuthPage) {

    return <>{children}</>;

  }

  return (

    <div
      className="
        min-h-screen
        overflow-hidden
        bg-[var(--bg-dark)]
        text-[var(--text-primary)]
        transition-colors
      "
    >

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
          onClick={() =>
            setSidebarOpen(false)
          }
          className="
            fixed
            inset-0
            z-40

            bg-black/40
            backdrop-blur-sm
          "
        />

      )}

      <div
        className={`
          transition-all
          duration-300
          min-h-screen

          ${

            sidebarOpen

              ? "lg:ml-[280px]"

              : "ml-0"

          }
        `}
      >

        {/* TOPBAR */}

        <header
          className="
            sticky
            top-0
            z-30

            h-16

            border-b
            border-[var(--border)]

            bg-[var(--bg-card)]/80
            backdrop-blur-xl

            px-5

            flex
            items-center
            justify-between
          "
        >

          {/* LEFT */}

          <div className="flex items-center gap-4">

            <button
              onClick={() =>
                setSidebarOpen(!sidebarOpen)
              }
              className="
                w-11
                h-11

                rounded-xl

                border
                border-[var(--border)]

                bg-[var(--bg-hover)]

                flex
                items-center
                justify-center

                hover:scale-105
                hover:border-[var(--primary)]

                transition-all
              "
            >

              <Menu size={20} />

            </button>

            <div>

              <h1 className="font-semibold text-lg">
                MC Inventory
              </h1>

              <p
                className="
                  text-xs
                  text-[var(--text-secondary)]
                "
              >
                Multi Cloud Inventory
              </p>

            </div>

          </div>

          {/* RIGHT */}

          <div className="flex items-center gap-5">

            <div className="text-right">

              <p
                className="
                  text-xs
                  text-[var(--text-secondary)]
                "
              >
                Última actualización
              </p>

              <p className="text-sm font-semibold">
                {time}
              </p>

            </div>

            <UserMenu />

          </div>

        </header>

        <main className="p-6">

          {children}

        </main>

      </div>

      <RouteLoadingOverlay visible={routeLoading} />

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
        ${
          visible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }
      `}
    >

      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Cargando módulo
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Preparando datos y visualizaciones...
            </p>
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-400" />
        </div>
      </div>

    </div>

  );

}
