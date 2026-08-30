import type { Metadata } from "next";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "NorthStar - goal-first trading copilot",
  description:
    "Set a destination, see honest odds, and let gated strategies work a paper account toward it. Not investment advice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      translate="no"
      className={`${outfit.variable} ${plexMono.variable} notranslate h-full antialiased`}
    >
      <body className="min-h-screen bg-void text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

