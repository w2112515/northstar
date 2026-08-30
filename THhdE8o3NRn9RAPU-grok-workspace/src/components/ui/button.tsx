import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium select-none whitespace-nowrap rounded-md text-sm transition-[color,background-color,box-shadow,transform,opacity] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-void),0_0_0_4px_var(--color-signal)]",
  {
    variants: {
      variant: {
        gold: "bg-gold text-void hover:bg-gold/90 shadow-tone-gold",
        teal: "bg-teal text-void hover:bg-teal/90",
        coral: "bg-coral text-void hover:bg-coral/90",
        amber: "bg-amber text-void hover:bg-amber/90",
        signal: "bg-signal text-ink hover:bg-signal/90",
        ghost: "bg-transparent text-ink hover:bg-panel shadow-border",
        quiet: "bg-panel text-ink hover:bg-panel/80 shadow-border",
        danger: "bg-coral-dim text-coral hover:bg-coral/20 shadow-tone-coral",
      },
      size: {
        sm: "h-9 px-3 text-xs rounded-sm",
        md: "h-10 px-3.5",
        lg: "h-11 px-5 rounded-lg",
        icon: "size-10 rounded-md",
        "icon-sm": "size-8 rounded-sm",
      },
    },
    defaultVariants: { variant: "quiet", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
