import type { ConnectedWallet, User } from "@privy-io/react-auth";
import { getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import { isAddress } from "viem";

/** Ethereum `ConnectedWallet` entries use `type: 'ethereum'` (SDK), not always `chainType`. */
function isEthereumConnectedWallet(w: ConnectedWallet): boolean {
  const x = w as { type?: string; chainType?: string };
  if (x.type === "ethereum") return true;
  if (x.chainType === "ethereum") return true;
  return false;
}

/**
 * Prefer Privy embedded wallet, then any Ethereum wallet from `useWallets()`.
 * `getEmbeddedConnectedWallet` alone misses Base Account / smart wallet / external
 * connectors that still show up in storage and linked accounts.
 */
export function pickEthereumDestinationWallet(
  wallets: ConnectedWallet[],
): ConnectedWallet | null {
  const embedded = getEmbeddedConnectedWallet(wallets);
  if (embedded) return embedded;
  const eth = wallets.find(isEthereumConnectedWallet);
  if (eth) return eth;
  // Partial / odd SDK states: any entry with a valid EVM address
  return (
    wallets.find((w) => {
      const a = (w as { address?: string }).address;
      return typeof a === "string" && isAddress(a);
    }) ?? null
  );
}

/** Ethereum address from Privy user when `useWallets()` is still empty or lacks a match. */
export function ethereumAddressFromPrivyUser(
  user: User | null | undefined,
): string | undefined {
  if (!user) return undefined;
  const w = user.wallet;
  if (w?.chainType === "ethereum" && w.address) return w.address;
  if (user.smartWallet?.address) return user.smartWallet.address;
  for (const a of user.linkedAccounts ?? []) {
    if (a.type === "wallet" && "address" in a && a.address) {
      if (a.chainType === "ethereum") return a.address;
      if (isAddress(a.address)) return a.address;
    }
    if (a.type === "smart_wallet" && "address" in a && a.address) {
      return a.address;
    }
  }
  return undefined;
}

/** Alamat EVM untuk profil / UI — selaras dengan prioritas halaman Mint. */
export function activeWalletEthereumAddress(
  activeWallet: unknown,
): string | undefined {
  if (!activeWallet) return undefined;
  const w = activeWallet as {
    type?: string;
    chainType?: string;
    address?: string;
  };
  if (!w.address || !isAddress(w.address)) return undefined;
  if (w.type === "ethereum" || w.chainType === "ethereum") return w.address;
  if (w.type === "solana" || w.chainType === "solana") return undefined;
  return w.address;
}

export function resolveWalletDisplayAddress(input: {
  wallets: import("@privy-io/react-auth").ConnectedWallet[];
  user: User | null | undefined;
  activeWallet: unknown;
  dbWallet: string | null | undefined;
}): string | undefined {
  const c = pickEthereumDestinationWallet(input.wallets);
  const fromActive = activeWalletEthereumAddress(input.activeWallet);
  const fromUser = ethereumAddressFromPrivyUser(input.user);
  const db = input.dbWallet?.trim();
  return c?.address ?? fromActive ?? fromUser ?? db ?? undefined;
}
