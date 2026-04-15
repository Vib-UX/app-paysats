"use client";

import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import {
  IDRX_TOKEN_ADDRESS,
  erc20Abi,
  IDRX_DECIMALS,
} from "@/lib/contracts/arka-dca";
import { useDcaOrder } from "@/hooks/use-dca-contract";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAddress, isAddress } from "viem";
import { getBasePublicClient } from "@/lib/base-client";
import { DcaActiveOrder } from "./dca-active-order";
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
      ? (Number(balance) / 10 ** IDRX_DECIMALS).toLocaleString("id-ID", {
          maximumFractionDigits: 2,
        })
      : "…";

  return (
    <Card className="mb-4 space-y-1.5 border-arka-border/60 bg-arka-surface-muted/40">
      <div className="flex items-center justify-between text-xs">
        <span className="text-arka-text-muted">Smart wallet</span>
        <span className="font-mono text-[11px] text-arka-text-muted">
          {smartAddr.slice(0, 6)}…{smartAddr.slice(-4)}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-arka-text">Saldo IDRX</span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {loading ? "Memuat…" : `${fmtBal} IDRX`}
        </span>
      </div>
    </Card>
  );
}

export function DcaClient() {
  const { order, loading, error, refetch } = useDcaOrder();

  if (loading) {
    return (
      <Screen title="DCA otomatis" subtitle="Memeriksa order aktif…">
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        </div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen
        title="DCA otomatis"
        subtitle="Tidak bisa membaca status DCA dari kontrak."
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
        title="DCA otomatis"
        subtitle="Chainlink Automation mengeksekusi swap IDRX → cbBTC sesuai jadwal."
      >
        <SmartWalletBalanceCard />
        <DcaActiveOrder order={order} onCancelled={refetch} />
      </Screen>
    );
  }

  return (
    <Screen
      title="DCA otomatis"
      subtitle="Jadwalkan pembelian cbBTC otomatis dari saldo IDRX kamu. Setelah order dibuat, Chainlink Automation mengeksekusi tanpa perlu aksi tambahan."
    >
      <SmartWalletBalanceCard />
      <DcaForm onCreated={refetch} />
    </Screen>
  );
}
