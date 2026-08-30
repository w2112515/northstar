import type { ReactNode } from "react";
import * as Alert from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export const AlertDialog = Alert.Root;
export const AlertDialogTrigger = Alert.Trigger;

export function AlertDialogContent({
  title,
  description,
  confirm,
  confirmTone = "coral",
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  confirm: string;
  confirmTone?: "coral" | "teal" | "gold";
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Alert.Portal>
      <Alert.Overlay className="fixed inset-0 z-50 bg-void-deep/70" />
      <Alert.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2",
          "rounded-xl bg-night p-5 shadow-[0_0_0_1px_var(--color-line),0_12px_40px_rgb(0_0_0/0.4)]",
        )}
      >
        <Alert.Title className="text-base font-medium text-ink">{title}</Alert.Title>
        <Alert.Description className="mt-2 text-sm text-mist">{description}</Alert.Description>
        {children}
        <div className="mt-5 flex justify-end gap-2">
          <Alert.Cancel asChild>
            <Button variant="ghost">Cancel</Button>
          </Alert.Cancel>
          <Alert.Action asChild>
            <Button variant={confirmTone} onClick={onConfirm}>
              {confirm}
            </Button>
          </Alert.Action>
        </div>
      </Alert.Content>
    </Alert.Portal>
  );
}
