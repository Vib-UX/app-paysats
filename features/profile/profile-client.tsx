"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { fetchWithPrivy } from "@/lib/api";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetchWithPrivy(getAccessToken, "/api/user/me");
    const j = (await res.json().catch(() => ({}))) as Partial<MePayload>;
    if (!res.ok) {
      setLoadError(t("profile.loadError"));
      return;
    }
    setMe({
      email: j.email ?? null,
      displayName: j.displayName ?? null,
      walletAddress: j.walletAddress ?? null,
      onboardingCompleted: Boolean(j.onboardingCompleted),
    });
  }, [getAccessToken, t]);

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
      <Screen title={t("profile.title")} subtitle={t("profile.subtitle")}>
        <p className="mb-4 text-sm text-arka-danger" role="alert">
          {loadError}
        </p>
        <Button variant="secondary" onClick={() => void load()}>
          {t("profile.retry")}
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
      title={t("profile.title")}
      subtitle={t("profile.subtitle")}
    >
      <Card className="mb-4 space-y-3 text-sm">
        <div>
          <p className="text-arka-text-muted">{t("profile.name")}</p>
          <p className="font-medium">{me.displayName || "—"}</p>
        </div>
        <div>
          <p className="text-arka-text-muted">{t("profile.email")}</p>
          <p className="font-medium">{me.email || "—"}</p>
        </div>
        <div>
          <p className="text-arka-text-muted">{t("profile.wallet")}</p>
          <p className="break-all font-mono text-xs">
            {walletDisplay || "—"}
          </p>
        </div>
        <div>
          <p className="text-arka-text-muted">{t("profile.onboarding")}</p>
          <p className="font-medium">
            {me.onboardingCompleted ? t("profile.onboardingDone") : t("profile.onboardingPending")}
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
        {t("profile.logout")}
      </Button>
    </Screen>
  );
}
