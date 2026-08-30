import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Chrome } from "@/components/chrome";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      className={`${geistSans.variable} ${geistMono.variable} notranslate h-full antialiased`}
    >
      <body className="starfield flex min-h-screen flex-col">
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
