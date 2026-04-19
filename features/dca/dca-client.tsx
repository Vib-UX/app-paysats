"use client";

import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import {
  IDRX_TOKEN_ADDRESS,
  erc20Abi,
  IDRX_DECIMALS,
} from "@/lib/contracts/arka-dca";
import { useDcaOrder } from "@/hooks/use-dca-contract";
import { useLocale, useT } from "@/lib/i18n";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAddress, isAddress } from "viem";
import { getBasePublicClient } from "@/lib/base-client";
import { DcaActiveOrder, SwapHistory } from "./dca-active-order";
import { DcaForm } from "./dca-form";

function useSmartAddr() {
  const { user } = usePrivy();
  const { client } = useSmartWallets();

  return useMemo(() => {
    const ca = client?.account?.address;
    if (ca && isAddress(ca)) return getAddress(ca);
    if (user?.smartWallet?.address && isAddress(user.smartWallet.address))
      return getAddress(user.smartWallet.address);
    for (const a of user?.linkedAccounts ?? []) {
      if (a.type === "smart_wallet" && "address" in a) {
        const addr = (a as { address: string }).address;
        if (isAddress(addr)) return getAddress(addr);
      }
    }
    return null;
  }, [user, client]);
}

function SmartWalletBalanceCard() {
  const { ready, authenticated } = usePrivy();
  const smartAddr = useSmartAddr();
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || !smartAddr || hasFetched.current) return;
    hasFetched.current = true;
    setLoading(true);
    const pc = getBasePublicClient();
    pc.readContract({
      address: IDRX_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [smartAddr],
    })
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setLoading(false));
  }, [ready, authenticated, smartAddr]);

  if (!smartAddr) return null;

  const fmtBal =
    balance != null
      ? (Number(balance) / 10 ** IDRX_DECIMALS).toLocaleString(localeStr, {
          maximumFractionDigits: 2,
        })
      : "…";

  return (
    <Card className="mb-4 space-y-1.5 border-arka-border/60 bg-arka-surface-muted/40">
      <div className="flex items-center justify-between text-xs">
        <span className="text-arka-text-muted">{t("dca.smartWallet")}</span>
        <span className="font-mono text-[11px] text-arka-text-muted">
          {smartAddr.slice(0, 6)}…{smartAddr.slice(-4)}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-arka-text">{t("dca.smartBalance")}</span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {loading ? t("dca.smartLoading") : `${fmtBal} IDRX`}
        </span>
      </div>
    </Card>
  );
}

export function DcaClient() {
  const { order, loading, error, refetch } = useDcaOrder();
  const t = useT();

  if (loading) {
    return (
      <Screen title={t("dca.title")} subtitle={t("dca.checkingOrder")}>
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        </div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen
        title={t("dca.title")}
        subtitle={t("dca.cannotRead")}
      >
        <SmartWalletBalanceCard />
        <p className="text-sm text-arka-danger" role="alert">
          {error}
        </p>
      </Screen>
    );
  }

  if (order) {
    return (
      <Screen
        title={t("dca.title")}
        subtitle={t("dca.subtitleActive")}
      >
        <SmartWalletBalanceCard />
        <DcaActiveOrder order={order} onCancelled={refetch} />
        {/* Rendered outside DcaActiveOrder so the history survives when the
            user cancels and the screen flips back to DcaForm. */}
        <div className="mt-4">
          <SwapHistory />
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      title={t("dca.title")}
      subtitle={t("dca.subtitleNew")}
    >
      <SmartWalletBalanceCard />
      <DcaForm onCreated={refetch} />
      {/* Persistent cross-cycle swap history — shown even when there's no
          active order so users can still see their prior DCA's swaps. */}
      <div className="mt-4">
        <SwapHistory />
      </div>
    </Screen>
  );
}
