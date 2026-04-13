"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { fetchWithPrivy } from "@/lib/api";
import { resolveWalletDisplayAddress } from "@/lib/privy-destination-wallet";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type MePayload = {
  email: string | null;
  displayName: string | null;
  walletAddress: string | null;
  onboardingCompleted: boolean;
};

export function ProfileClient() {
  const { logout, getAccessToken, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();
  const router = useRouter();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetchWithPrivy(getAccessToken, "/api/user/me");
    const j = (await res.json().catch(() => ({}))) as Partial<MePayload>;
    if (!res.ok) {
      setLoadError("Gagal memuat profil");
      return;
    }
    setMe({
      email: j.email ?? null,
      displayName: j.displayName ?? null,
      walletAddress: j.walletAddress ?? null,
      onboardingCompleted: Boolean(j.onboardingCompleted),
    });
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    void load();
  }, [ready, authenticated, load]);

  const walletDisplay = useMemo(() => {
    if (!me) return undefined;
    return resolveWalletDisplayAddress({
      wallets,
      user,
      activeWallet,
      dbWallet: me.walletAddress,
    });
  }, [me, wallets, user, activeWallet]);

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Screen title="Profil" subtitle="Akun Arka dan dompet Privy kamu.">
        <p className="mb-4 text-sm text-arka-danger" role="alert">
          {loadError}
        </p>
        <Button variant="secondary" onClick={() => void load()}>
          Coba lagi
        </Button>
      </Screen>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
      </div>
    );
  }

  return (
    <Screen
      title="Profil"
      subtitle="Akun Arka dan dompet Privy kamu. Informasi sensitif mitra (IDRX) hanya
          disimpan terenkripsi di server."
    >
      <Card className="mb-4 space-y-3 text-sm">
        <div>
          <p className="text-arka-text-muted">Nama</p>
          <p className="font-medium">{me.displayName || "—"}</p>
        </div>
        <div>
          <p className="text-arka-text-muted">Email</p>
          <p className="font-medium">{me.email || "—"}</p>
        </div>
        <div>
          <p className="text-arka-text-muted">Dompet Arka</p>
          <p className="break-all font-mono text-xs">
            {walletDisplay || "—"}
          </p>
        </div>
        <div>
          <p className="text-arka-text-muted">Onboarding IDRX</p>
          <p className="font-medium">
            {me.onboardingCompleted ? "Selesai" : "Belum selesai"}
          </p>
        </div>
      </Card>
      <Button
        variant="secondary"
        onClick={async () => {
          await logout();
          router.replace("/auth");
          router.refresh();
        }}
      >
        Keluar
      </Button>
    </Screen>
  );
}
