import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-brand-pink)] text-white hover:bg-[#ec5fa1]",
        outline:
          "border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[var(--color-background)]",
        ghost:
          "text-[var(--color-muted)] hover:bg-[var(--color-background)] hover:text-[var(--color-foreground)]",
        segment:
          "border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
        segmentActive:
          "border border-[var(--color-brand-pink)] bg-[var(--color-brand-pink)] text-white",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
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
