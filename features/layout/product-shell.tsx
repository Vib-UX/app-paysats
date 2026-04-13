"use client";

import { usePostLoginSync } from "@/hooks/use-post-login-sync";
import { IdrxBalancePill } from "@/features/layout/idrx-balance";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

const nav = [
  { href: "/mint", label: "Mint" },
  { href: "/activity", label: "Aktivitas" },
  { href: "/profile", label: "Profil" },
];

export function ProductShell({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const pathname = usePathname();
  const sync = usePostLoginSync();

  const syncRef = useRef(sync);
  useLayoutEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    void syncRef.current();
  }, [ready, authenticated]);

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-arka-border bg-arka-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link href="/mint" className="shrink-0 text-sm font-semibold text-arka-text">
            Arka
          </Link>
          <div className="min-w-0 flex flex-1 justify-center px-1">
            <IdrxBalancePill />
          </div>
          <span className="shrink-0 text-xs text-arka-text-muted">Produk</span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-arka-border bg-arka-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-md justify-around py-2">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-w-[4.5rem] rounded-lg px-2 py-2 text-center text-xs font-medium ${
                  active
                    ? "text-arka-accent"
                    : "text-arka-text-muted hover:text-arka-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
