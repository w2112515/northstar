import type { ComponentProps } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export function Switch({
  className,
  tone = "teal",
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root> & { tone?: "teal" | "gold" | "coral" | "amber" }) {
  const checked =
    tone === "gold"
      ? "data-[state=checked]:bg-gold"
      : tone === "coral"
        ? "data-[state=checked]:bg-coral"
        : tone === "amber"
          ? "data-[state=checked]:bg-amber"
          : "data-[state=checked]:bg-teal";
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full bg-line transition-[background-color] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-void),0_0_0_4px_var(--color-signal)]",
        "disabled:opacity-40",
        checked,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="block size-5 translate-x-0.5 rounded-full bg-ink transition-transform duration-150 ease-out data-[state=checked]:translate-x-[18px]"
      />
    </SwitchPrimitive.Root>
  );
}
