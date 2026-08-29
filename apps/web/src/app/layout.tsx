import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { PaperBadge } from "@/components/ui";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NorthStar - goal-first trading copilot",
  description:
    "Set a destination, see honest odds, let gated strategies sail a paper account. Not investment advice.",
};

const nav = [
  { href: "/", label: "Cockpit" },
  { href: "/strategies", label: "Strategies" },
  { href: "/lab", label: "Evolution Lab" },
  { href: "/journal", label: "Voyage Journal" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="starfield min-h-full">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
          <header className="flex items-center justify-between gap-3 border-b border-line/60 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-gold/50 bg-surface text-gold">
                ✦
              </span>
              <span className="text-lg font-semibold tracking-tight">
                NorthStar
                <span className="ml-2 hidden text-xs font-normal text-muted sm:inline">
                  set the star, we sail the boat
                </span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <PaperBadge />
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-line/60 py-2 md:hidden">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface hover:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 py-6">{children}</main>
          <footer className="border-t border-line/60 py-4 text-center text-[11px] leading-relaxed text-muted/70">
            Paper trading only - simulated money, real market data. Probabilities are estimates from
            historical patterns, not promises. Nothing here is investment advice.
          </footer>
        </div>
      </body>
    </html>
  );
}
