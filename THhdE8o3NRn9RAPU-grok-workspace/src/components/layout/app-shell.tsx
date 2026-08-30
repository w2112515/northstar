import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Gauge, Layers, Radar, Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { NorthStarMark } from "@/components/marks";
import { StatusRibbon } from "./status-ribbon";
import { SettingsSheet } from "./settings-sheet";
import { StateBanners } from "./banners";
import { HydrateStore } from "./hydrate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV = [
  { to: "/", label: "Cockpit", icon: Gauge },
  { to: "/research", label: "Research", icon: Radar },
  { to: "/strategies", label: "Strategies", icon: Layers },
  { to: "/journal", label: "Journal", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [settings, setSettings] = useState(false);

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-void text-ink">
      <HydrateStore />
      <aside className="hidden w-14 shrink-0 flex-col items-center border-r border-line bg-night py-3 md:flex">
        <Link to="/" aria-label="NorthStar cockpit" className="mb-5 text-gold">
          <NorthStarMark className="size-5" />
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-1">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex size-10 items-center justify-center rounded-md text-mist",
                      "transition-[color,background-color] duration-150 ease-out",
                      active ? "bg-panel text-ink" : "hover:bg-panel/70 hover:text-ink",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 h-4 w-px rounded-full bg-signal" />
                    )}
                    <Icon className="size-4" strokeWidth={1.6} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setSettings(true)}
              className="flex size-10 items-center justify-center rounded-md text-mist hover:bg-panel hover:text-ink transition-[color,background-color] duration-150"
            >
              <Settings className="size-4" strokeWidth={1.6} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <StatusRibbon pathname={pathname} />
        <main className="min-w-0 flex-1 px-3 py-3 pb-24 md:px-4 md:pb-4">
          <StateBanners />
          <div className="min-w-0">{children}</div>
          <footer className="mt-6 pb-1 text-center text-micro leading-relaxed text-mist/60">
            Paper trading · live prices · historical odds, not a promise
          </footer>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-night/95 backdrop-blur-sm md:hidden">
        {NAV.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-micro tracking-wide",
                active ? "text-ink" : "text-mist",
              )}
            >
              {active && <span className="absolute top-0 h-px w-6 bg-signal" />}
              <Icon className="size-4" strokeWidth={1.6} />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setSettings(true)}
          className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-micro text-mist"
        >
          <Settings className="size-4" strokeWidth={1.6} />
          Settings
        </button>
      </nav>

      <SettingsSheet open={settings} onOpenChange={setSettings} />
    </div>
  );
}
