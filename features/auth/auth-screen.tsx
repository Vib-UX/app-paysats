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
} from "react";

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
        router.replace("/mint");
      } catch (e) {
        console.error("Post-login setup failed:", e);
        if (cancelled) return;
        setMeChecked(true);
        router.replace("/mint");
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
    <div className="flex min-h-[70vh] flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-arka-accent">
            Arka
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-arka-text">
            Masuk dengan Google
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-arka-text-muted">
            Aplikasi tabungan Bitcoin yang tenang dan terstruktur. Arka membuat
            dompet aman untuk kamu secara otomatis setelah masuk.
          </p>
        </div>

        <Card className="space-y-4">
          <Button
            variant="primary"
            disabled={oauthStatus === "loading"}
            className="gap-2"
            onClick={() => initOAuth({ provider: "google" })}
          >
            {oauthStatus === "loading" ? "Menghubungkan…" : "Lanjutkan dengan Google"}
          </Button>
          <p className="text-center text-xs leading-relaxed text-arka-text-muted">
            Dengan melanjutkan, kamu menyetujui pembuatan dompet terenkripsi
            (embedded wallet) yang dikelola Privy untuk transaksi IDRX dan
            tabungan ke depannya.
          </p>
          {err ? (
            <p className="text-center text-sm text-arka-danger">{err}</p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
