"use client";

/** Chrome gate: the /start wizard is the one dark, chromeless room - no top
 *  bar, no footer, full-bleed. Every other page gets the standard frame. */

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/topbar";

export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/start";
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-hairline focus:bg-raised focus:px-3 focus:py-2 focus:text-body focus:text-indigo"
      >
        Skip to content
      </a>
      {!bare && <TopBar />}
      {bare ? (
        <main id="main" className="flex-1">{children}</main>
      ) : (
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      )}
      {!bare && (
        <footer className="border-t border-hairline py-4 text-center text-micro leading-relaxed text-ink2">
          Paper trading only - simulated money, real market data. Probabilities are estimates from
          historical patterns, not promises. Nothing here is investment advice.
        </footer>
      )}
    </>
  );
}
