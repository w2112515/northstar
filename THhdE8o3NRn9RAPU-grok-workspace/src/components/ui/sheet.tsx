import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;

export function SheetContent({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-void-deep/60" />
      <Dialog.Content
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-[min(26rem,100vw)] flex-col bg-night shadow-[0_0_0_1px_var(--color-line)]",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <Dialog.Title className="text-sm font-medium text-ink">{title}</Dialog.Title>
          <Dialog.Close className="size-10 rounded-md text-mist hover:bg-panel hover:text-ink transition-[background-color,color] duration-150">
            <X className="mx-auto size-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
