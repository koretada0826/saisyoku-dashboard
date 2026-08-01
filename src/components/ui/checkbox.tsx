"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  /** チェック時のアクセント色(CSS色) */
  color?: string;
  className?: string;
};

/** 色と凡例を兼ねたチェックボックス(グラフの指標ON/OFFに使用) */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  color,
  className,
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer select-none items-center gap-1.5 text-xs text-[var(--color-foreground)]",
        className,
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border transition-colors",
          checked
            ? "border-transparent text-white"
            : "border-[var(--color-border-subtle)] bg-white",
        )}
        style={checked ? { backgroundColor: color ?? "var(--color-brand-pink)" } : undefined}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span className="inline-flex items-center gap-1">
        {color && (
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        )}
        {label}
      </span>
    </label>
  );
}
