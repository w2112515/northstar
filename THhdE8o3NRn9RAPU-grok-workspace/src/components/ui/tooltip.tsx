import type { ComponentProps } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-xs rounded-md bg-panel px-2.5 py-1.5 text-xs text-ink shadow-[0_0_0_1px_var(--color-line),0_12px_40px_rgb(0_0_0/0.28)]",
          "data-[state=delayed-open]:animate-feed-in",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
