"use client";

import { defaultChainId } from "@/lib/chains";
import { fetchWithPrivy } from "@/lib/api";
import { resolveWalletDisplayAddress } from "@/lib/privy-destination-wallet";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useEffect, useMemo, useState } from "react";

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";

/** Saldo IDRX on-chain: kirim `walletAddress` ke API (resolve dari Privy + /api/user/me). */
export function IdrxBalancePill() {
  const { getAccessToken, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();
  const [state, setState] = useState<LoadState>("idle");
  const [label, setLabel] = useState<string>("");
  const [dbWallet, setDbWallet] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchWithPrivy(getAccessToken, "/api/user/me");
      const j = (await res.json().catch(() => ({}))) as {
        walletAddress?: string | null;
      };
      if (cancelled) return;
      if (res.ok && typeof j.walletAddress === "string" && j.walletAddress) {
        setDbWallet(j.walletAddress);
      } else {
        setDbWallet(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  const resolvedAddress = useMemo(
    () =>
      resolveWalletDisplayAddress({
        wallets,
        user,
        activeWallet,
        dbWallet,
      }),
    [wallets, user, activeWallet, dbWallet],
  );

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void (async () => {
      setState("loading");
      if (!resolvedAddress) {
        setState("empty");
        setLabel("—");
        return;
      }
      const chain = defaultChainId();
      const qs = new URLSearchParams({
        networkChainId: chain,
        walletAddress: resolvedAddress,
      });
      const res = await fetchWithPrivy(
        getAccessToken,
        `/api/idrx/balance?${qs.toString()}`,
      );
      const j = (await res.json().catch(() => ({}))) as {
        balanceFormatted?: string | null;
        error?: string;
        walletAddress?: string | null;
      };
      if (cancelled) return;
      if (!res.ok || j.error || j.balanceFormatted == null) {
        setState(j.walletAddress == null ? "empty" : "error");
        setLabel("—");
        return;
      }
      const n = Number(j.balanceFormatted);
      const formatted = Number.isFinite(n)
        ? n.toLocaleString("id-ID", { maximumFractionDigits: 6 })
        : j.balanceFormatted;
      setLabel(formatted);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, resolvedAddress]);

  if (!ready || !authenticated) return null;

  return (
    <div className="inline-flex max-w-full flex-col items-center rounded-full bg-arka-surface-muted px-2.5 py-1 text-center text-xs leading-tight text-arka-text">
      <span className="text-[10px] font-medium uppercase tracking-wide text-arka-text-muted">
        IDRX
      </span>
      <span className="min-h-[1rem] w-full max-w-[11rem] break-words font-semibold tabular-nums text-arka-text sm:max-w-none">
        {state === "loading" ? (
          <span className="text-arka-text-muted">Memuat…</span>
        ) : state === "ready" ? (
          label
        ) : state === "empty" ? (
          <span className="text-arka-text-muted" title="Dompet belum terdeteksi">
            —
          </span>
        ) : (
          <span className="text-arka-text-muted" title="Gagal memuat saldo">
            —
          </span>
        )}
      </span>
    </div>
  );
}
