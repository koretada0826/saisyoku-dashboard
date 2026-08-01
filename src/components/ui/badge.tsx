import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "mock" | "source" | "info";

const toneClass: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--color-background)] text-[var(--color-muted)] border-[var(--color-border-subtle)]",
  mock: "bg-[var(--color-brand-blue-soft)] text-[#2563eb] border-transparent",
  source:
    "bg-[var(--color-background)] text-[var(--color-muted)] border-[var(--color-border-subtle)]",
  info: "bg-[var(--color-brand-purple-soft)] text-[#8b5cf6] border-transparent",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
