"use client";

import { fetchWithPrivy } from "@/lib/api";
import { getBasePublicClient } from "@/lib/base-client";
import { defaultChainId } from "@/lib/chains";
import { erc20Abi } from "@/lib/contracts/paysats-dca";
import { USDC_ADDRESS, USDC_DECIMALS } from "@/lib/contracts/morpho-credit";
import { resolveWalletDisplayAddress } from "@/lib/privy-destination-wallet";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatUnits } from "viem";

export type LoadState = "idle" | "loading" | "ready" | "error";

export type BalancesSnapshot = {
  /** Wallet address all balances were fetched against. */
  walletAddress: string | null;

  /** IDRX balance as a raw decimal number (IDR equivalent). */
  idrx: number | null;
  idrxState: LoadState;
  idrxError: string | null;

  /** cbBTC balance expressed in sats. */
  btcSats: number | null;
  btcConfigured: boolean | null;
  btcState: LoadState;

  /** USDC balance as a decimal number. */
  usdc: number | null;
  usdcState: LoadState;
};

const defaultSnapshot: BalancesSnapshot = {
  walletAddress: null,
  idrx: null,
  idrxState: "idle",
  idrxError: null,
  btcSats: null,
  btcConfigured: null,
  btcState: "idle",
  usdc: null,
  usdcState: "idle",
};

/**
 * Centralized balance fetching for IDRX / cbBTC (sats) / USDC.
 * Lifted out of DashboardClient so Home and Cash can share state.
 */
export function useBalances(): BalancesSnapshot & {
  reload: () => Promise<void>;
  loading: boolean;
} {
  const { getAccessToken, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();

  const [dbWallet, setDbWallet] = useState<string | null>(null);
  const [snap, setSnap] = useState<BalancesSnapshot>(defaultSnapshot);

  const tokenRef = useRef(getAccessToken);
  useLayoutEffect(() => {
    tokenRef.current = getAccessToken;
  }, [getAccessToken]);

  const gen = useRef(0);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWithPrivy(tokenRef.current, "/api/user/me");
        const j = (await res.json().catch(() => ({}))) as {
          walletAddress?: string | null;
        };
        if (cancelled) return;
        setDbWallet(
          res.ok && typeof j.walletAddress === "string" && j.walletAddress
            ? j.walletAddress
            : null,
        );
      } catch {
        if (!cancelled) setDbWallet(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated]);

  const resolvedAddress = useMemo(
    () =>
      resolveWalletDisplayAddress({
        wallets,
        user,
        activeWallet,
        dbWallet,
      }) ?? null,
    [wallets, user, activeWallet, dbWallet],
  );

  const reload = useCallback(async () => {
    if (!resolvedAddress) {
      gen.current += 1;
      setSnap({ ...defaultSnapshot });
      return;
    }
    const g = ++gen.current;

    setSnap((s) => ({
      ...s,
      walletAddress: resolvedAddress,
      idrxState: "loading",
      btcState: "loading",
      usdcState: "loading",
    }));

    const chain = defaultChainId();
    const qs = new URLSearchParams({
      networkChainId: chain,
      walletAddress: resolvedAddress,
    }).toString();
    const tokenFn = tokenRef.current;

    const tasks: Promise<Partial<BalancesSnapshot>>[] = [
      (async () => {
        try {
          const r = await fetchWithPrivy(
            tokenFn,
            `/api/idrx/balance?${qs}`,
          );
          const j = (await r.json().catch(() => ({}))) as {
            balanceFormatted?: string | number | null;
            error?: string;
          };
          if (r.ok && j.balanceFormatted != null && !j.error) {
            const n =
              typeof j.balanceFormatted === "number"
                ? j.balanceFormatted
                : Number(j.balanceFormatted);
            return Number.isFinite(n)
              ? { idrx: n, idrxState: "ready" as LoadState, idrxError: null }
              : {
                  idrx: null,
                  idrxState: "error" as LoadState,
                  idrxError: "Invalid number",
                };
          }
          return {
            idrx: null,
            idrxState: "error" as LoadState,
            idrxError: j.error ?? null,
          };
        } catch {
          return {
            idrx: null,
            idrxState: "error" as LoadState,
            idrxError: null,
          };
        }
      })(),
      (async () => {
        try {
          const opts =
            typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
              ? { signal: AbortSignal.timeout(25_000) }
              : {};
          const r = await fetchWithPrivy(
            tokenFn,
            `/api/wallet/btc-balance?${qs}`,
            opts,
          );
          const j = (await r.json().catch(() => ({}))) as {
            configured?: boolean;
            balanceRaw?: string | null;
            balanceFormatted?: string | number | null;
            error?: string;
          };
          if (j.configured === false) {
            return {
              btcConfigured: false,
              btcSats: null,
              btcState: "ready" as LoadState,
            };
          }
          if (
            r.ok &&
            !j.error &&
            (j.balanceRaw != null || j.balanceFormatted != null)
          ) {
            const sats = j.balanceRaw != null ? Number(j.balanceRaw) : null;
            const resolved =
              sats != null && Number.isFinite(sats)
                ? sats
                : Math.round(Number(j.balanceFormatted) * 1e8);
            return {
              btcConfigured: true,
              btcSats: Number.isFinite(resolved) ? resolved : 0,
              btcState: "ready" as LoadState,
            };
          }
          return {
            btcConfigured: true,
            btcSats: null,
            btcState: "error" as LoadState,
          };
        } catch {
          return {
            btcConfigured: true,
            btcSats: null,
            btcState: "error" as LoadState,
          };
        }
      })(),
      (async () => {
        try {
          const pc = getBasePublicClient();
          const raw = await pc.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [resolvedAddress as `0x${string}`],
          });
          const n = Number(formatUnits(raw, USDC_DECIMALS));
          return {
            usdc: Number.isFinite(n) ? n : 0,
            usdcState: "ready" as LoadState,
          };
        } catch {
          return { usdc: null, usdcState: "error" as LoadState };
        }
      })(),
    ];

    const parts = await Promise.all(tasks);
    if (g !== gen.current) return;
    setSnap((s) => {
      const merged: BalancesSnapshot = { ...s };
      for (const p of parts) Object.assign(merged, p);
      return merged;
    });
  }, [resolvedAddress]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, reload]);

  const loading =
    snap.idrxState === "loading" ||
    snap.btcState === "loading" ||
    snap.usdcState === "loading";

  return { ...snap, reload, loading };
}
