import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-arka-border bg-arka-surface p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
