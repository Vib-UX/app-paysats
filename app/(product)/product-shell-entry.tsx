"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

function ShellLoading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      suppressHydrationWarning
    >
      <div
        className="h-8 w-8 animate-pulse rounded-full bg-paysats-border"
        suppressHydrationWarning
      />
    </div>
  );
}

const ProductShellLazy = dynamic(
  () =>
    import("@/features/layout/product-shell").then((m) => ({
      default: m.ProductShell,
    })),
  { ssr: false, loading: ShellLoading },
);

export function ProductShellEntry({ children }: { children: ReactNode }) {
  return <ProductShellLazy>{children}</ProductShellLazy>;
}
