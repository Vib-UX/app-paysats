import type { ConnectedWallet, User } from "@privy-io/react-auth";
import { isAddress } from "viem";

/**
 * Smart-wallet-first address resolution.
 *
 * Priority: smart wallet (from Privy user) → embedded EOA → any connected wallet.
 * The smart wallet is the primary on-chain identity: it holds assets, receives
 * IDRX mints, and interacts with contracts (DCA, swaps).
 */

/** Ethereum address from Privy User object — smart wallet first. */
export function ethereumAddressFromPrivyUser(
  user: User | null | undefined,
): string | undefined {
  if (!user) return undefined;

  if (user.smartWallet?.address && isAddress(user.smartWallet.address)) {
    return user.smartWallet.address;
  }
  for (const a of user.linkedAccounts ?? []) {
    if (a.type === "smart_wallet" && "address" in a && a.address) {
      if (isAddress(a.address)) return a.address;
    }
  }

  const w = user.wallet;
  if (w?.chainType === "ethereum" && w.address && isAddress(w.address)) {
    return w.address;
  }
  for (const a of user.linkedAccounts ?? []) {
    if (a.type === "wallet" && "address" in a && a.address) {
      if (a.chainType === "ethereum" || isAddress(a.address)) return a.address;
    }
  }
  return undefined;
}

function isEthereumConnectedWallet(w: ConnectedWallet): boolean {
  const x = w as { type?: string; chainType?: string };
  if (x.type === "ethereum") return true;
  if (x.chainType === "ethereum") return true;
  return false;
}

/**
 * Pick the best Ethereum ConnectedWallet from `useWallets()`.
 * Still prefers embedded for raw provider access (signing), but the *address*
 * shown to users comes from `resolveWalletDisplayAddress` which prefers smart.
 */
export function pickEthereumDestinationWallet(
  wallets: ConnectedWallet[],
): ConnectedWallet | null {
  const embedded = wallets.find(
    (w) => w.walletClientType === "privy" && isEthereumConnectedWallet(w),
  );
  if (embedded) return embedded;
  const eth = wallets.find(isEthereumConnectedWallet);
  if (eth) return eth;
  return (
    wallets.find((w) => {
      const a = (w as { address?: string }).address;
      return typeof a === "string" && isAddress(a);
    }) ?? null
  );
}

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

/**
 * Single source of truth for "the user's on-chain address" across the whole app.
 * Priority: smart wallet → embedded/active wallet → DB fallback.
 */
export function resolveWalletDisplayAddress(input: {
  wallets: import("@privy-io/react-auth").ConnectedWallet[];
  user: User | null | undefined;
  activeWallet: unknown;
  dbWallet: string | null | undefined;
}): string | undefined {
  const fromUser = ethereumAddressFromPrivyUser(input.user);
  if (fromUser) return fromUser;

  const c = pickEthereumDestinationWallet(input.wallets);
  if (c?.address) return c.address;

  const fromActive = activeWalletEthereumAddress(input.activeWallet);
  if (fromActive) return fromActive;

  const db = input.dbWallet?.trim();
  return db || undefined;
}
