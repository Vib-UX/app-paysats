"use client";

import { usePostLoginSync } from "@/hooks/use-post-login-sync";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

const nav = [
  { href: "/home", label: "Beranda" },
  { href: "/savings", label: "Tabungan" },
  { href: "/mint", label: "Deposit" },
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
        <div className="flex items-center justify-center">
          <Link
            href="/home"
            className="text-center text-sm font-semibold tracking-tight text-arka-text"
          >
            Arka
          </Link>
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
                className={`min-w-[3.25rem] rounded-lg px-1.5 py-2 text-center text-[11px] font-medium leading-tight sm:min-w-[4rem] sm:text-xs ${
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
