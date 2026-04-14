"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePostLoginSync } from "@/hooks/use-post-login-sync";
import { fetchWithPrivy } from "@/lib/api";
import { useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

function FeaturePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-arka-border bg-arka-surface px-3 py-1 text-xs font-medium text-arka-text">
      {children}
    </span>
  );
}

export function AuthScreen() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { initOAuth, state } = useLoginWithOAuth();
  const router = useRouter();
  const sync = usePostLoginSync();
  const [meChecked, setMeChecked] = useState(false);

  const getAccessTokenRef = useRef(getAccessToken);
  const syncRef = useRef(sync);
  useLayoutEffect(() => {
    getAccessTokenRef.current = getAccessToken;
    syncRef.current = sync;
  }, [getAccessToken, sync]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      startTransition(() => setMeChecked(false));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await syncRef.current();
        await fetchWithPrivy(getAccessTokenRef.current, "/api/user/me");
        if (cancelled) return;
        setMeChecked(true);
        router.replace("/home");
      } catch (e) {
        console.error("Post-login setup failed:", e);
        if (cancelled) return;
        setMeChecked(true);
        router.replace("/home");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        <p className="mt-4 text-sm text-arka-text-muted">Memuat…</p>
      </div>
    );
  }

  if (authenticated && !meChecked && ready) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        <p className="mt-4 text-sm text-arka-text-muted">
          Menyiapkan akun kamu…
        </p>
      </div>
    );
  }

  if (authenticated) {
    return null;
  }

  const oauthStatus = state.status;
  const err =
    oauthStatus === "error"
      ? "Login gagal. Coba lagi atau periksa koneksi."
      : null;

  return (
    <div className="flex min-h-[80vh] flex-col justify-between px-6 py-10">
      <div className="mx-auto w-full max-w-md flex-1 space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-arka-accent text-xl font-bold text-white shadow-sm">
            A
          </div>
          <p className="mt-4 text-lg font-bold tracking-tight text-arka-text">
            ARKA
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-dashed border-arka-border bg-arka-surface-muted/40 px-6 py-10 text-center">
          <p className="text-xs text-arka-text-muted">Ilustrasi produk</p>
          <p className="mt-2 text-sm text-arka-text-muted">
            Tabungan bertahap ke Bitcoin lewat IDRX di Base.
          </p>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-semibold leading-snug text-arka-text">
            Simpan lewat tabungan ke{" "}
            <span className="text-arka-accent">BTC</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-arka-text-muted">
            Atur tujuan tabungan dan alokasi aset. Deposit IDR lewat mint IDRX ke
            dompet Privy kamu — mulai dari nominal kecil sesuai kebijakan mitra.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <FeaturePill>Tabungan</FeaturePill>
            <FeaturePill>Auto DCA</FeaturePill>
            <FeaturePill>IDRX · Base</FeaturePill>
          </div>
        </div>

        <Card className="space-y-4">
          <Button
            variant="secondary"
            disabled={oauthStatus === "loading"}
            className="gap-2 border-arka-border"
            onClick={() => initOAuth({ provider: "google" })}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#4285F4]">
              G
            </span>
            {oauthStatus === "loading"
              ? "Menghubungkan…"
              : "Lanjutkan dengan Google"}
          </Button>
          <p className="text-center text-xs leading-relaxed text-arka-text-muted">
            Investasi aset kripto mengandung risiko pasar.
          </p>
          {err ? (
            <p className="text-center text-sm text-arka-danger">{err}</p>
          ) : null}
        </Card>
      </div>

      <p className="mx-auto mt-8 max-w-md text-center text-[11px] leading-relaxed text-arka-text-muted">
        Dengan melanjutkan, kamu menyetujui{" "}
        <a
          href="https://www.privy.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-arka-accent hover:underline"
        >
          kebijakan penyedia dompet (Privy)
        </a>{" "}
        dan pembuatan dompet embedded untuk transaksi di aplikasi ini.
      </p>
    </div>
  );
}
