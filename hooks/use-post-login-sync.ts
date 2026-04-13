"use client";

import { fetchWithPrivy } from "@/lib/api";
import { pickEthereumDestinationWallet } from "@/lib/privy-destination-wallet";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Syncs Privy user + embedded wallet into our DB (Bearer + optional cookie).
 * Wallet list identity changes frequently from `useWallets()`; keep a stable
 * callback so consumers' useEffects do not re-fire in a loop.
 */
export function usePostLoginSync() {
  const { getAccessToken, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const walletsRef = useRef(wallets);
  useLayoutEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  const lastSync = useRef<string | null>(null);

  return useCallback(async () => {
    if (!authenticated) return;
    const primary = pickEthereumDestinationWallet(walletsRef.current);
    const walletAddress = primary?.address;
    const key = walletAddress ?? "no-wallet";
    if (lastSync.current === key) return;
    const res = await fetchWithPrivy(getAccessToken, "/api/user/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(walletAddress ? { walletAddress } : {}),
    });
    if (res.ok) lastSync.current = key;
  }, [authenticated, getAccessToken]);
}
