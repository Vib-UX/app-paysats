"use client";

import dynamic from "next/dynamic";

function AuthLoading() {
  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6"
      suppressHydrationWarning
    >
      <div
        className="h-8 w-8 animate-pulse rounded-full bg-arka-border"
        suppressHydrationWarning
      />
      <p className="mt-4 text-sm text-arka-text-muted">Memuat…</p>
    </div>
  );
}

/** Client-only mount so browser extensions cannot inject attributes into SSR HTML (bis_skin_checked, etc.). */
const AuthScreenLazy = dynamic(
  () =>
    import("@/features/auth/auth-screen").then((m) => ({ default: m.AuthScreen })),
  { ssr: false, loading: AuthLoading },
);

export function AuthEntry() {
  return <AuthScreenLazy />;
}
