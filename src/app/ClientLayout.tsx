"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

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

    </div>

  );

}