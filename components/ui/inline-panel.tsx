"use client";

import type { ReactNode } from "react";

export function InlinePanel({
  open,
  maxHeight = 720,
  children,
  className = "",
}: {
  open: boolean;
  maxHeight?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${className}`}
      style={{ maxHeight: open ? maxHeight : 0 }}
      aria-hidden={!open}
    >
      {children}
    </div>
  );
}
