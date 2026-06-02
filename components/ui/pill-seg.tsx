"use client";

import type { ReactNode } from "react";

export type PillSegOption<T extends string> = {
  value: T;
  label: ReactNode;
};

export function PillSeg<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: PillSegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex gap-0 rounded-[var(--radius-control)] bg-paysats-surface-muted p-[3px] ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-[10px] px-3 py-2 text-xs font-bold transition ${
              active
                ? "bg-paysats-surface text-paysats-text shadow-[0_1px_3px_rgba(22,18,16,0.06)]"
                : "bg-transparent text-paysats-text-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
