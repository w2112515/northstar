import { cn } from "@/lib/cn";

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return (
    <div
      role="separator"
      className={cn(
        "bg-line",
        vertical ? "w-px self-stretch" : "h-px w-full",
        className,
      )}
    />
  );
}
