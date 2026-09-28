"use client";

import {
  SessionProvider
} from "next-auth/react";

import { AuditClientProvider } from "@/lib/audit/client";

import {
  ThemeProvider
} from "./ThemeProvider";

export default function Providers({
  children
}: {
  children: React.ReactNode;
}) {

  return (

    <SessionProvider>

      <AuditClientProvider />

      <ThemeProvider>

        {children}

      </ThemeProvider>

    </SessionProvider>

  );

}