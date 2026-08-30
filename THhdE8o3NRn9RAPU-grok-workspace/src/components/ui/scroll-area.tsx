import type { ReactNode } from "react";
import * as Scroll from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/cn";

export function ScrollArea({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Scroll.Root className={cn("overflow-hidden", className)}>
      <Scroll.Viewport className="h-full w-full">{children}</Scroll.Viewport>
      <Scroll.Scrollbar
        orientation="vertical"
        className="flex w-2 touch-none select-none p-0.5"
      >
        <Scroll.Thumb className="relative flex-1 rounded-full bg-line" />
      </Scroll.Scrollbar>
    </Scroll.Root>
  );
}
