import { getBasePublicClient } from "@/lib/base-client";
import {
  CBBTC_DECIMALS,
  erc20Abi,
  IDRX_DECIMALS,
  IDRX_TOKEN_ADDRESS,
  INTERVAL_PRESETS,
  PAYSATS_DCA_ADDRESS,
  paysatsDcaAbi,
} from "@/lib/contracts/paysats-dca";
import { ServiceError } from "@/services/errors";
import { getPreferredEthereumAddress } from "@/services/privy/server";
import type { User } from "@privy-io/server-auth";
import { getAddress, isAddress, type Address } from "viem";

export function intervalLabel(seconds: number): string {
  const match = INTERVAL_PRESETS.find((p) => p.seconds === seconds);
  return match?.label ?? `${seconds}s`;
}

export type DcaOrderView = {
  active: boolean;
  amountPerSwapRaw: string;
  amountPerSwapIdr: number;
  intervalSeconds: number;
  intervalLabel: string;
  totalSwaps: number;
  executedSwaps: number;
  lastExecutedAt: number;
  minOutputBps: number;
};

export type AccountBalances = {
  walletAddress: string;
  idrxRaw: string;
  idrxAmount: number;
  cbBtcRaw: string;
  cbBtcSats: number;
};

export function requireWalletAddress(privyUser: User): Address {
  const wallet = getPreferredEthereumAddress(privyUser);
  if (!wallet || !isAddress(wallet)) {
    throw new ServiceError(400, "Wallet tidak ditemukan");
  }
  return getAddress(wallet);
}

export async function getDcaOrder(
  privyUser: User,
): Promise<DcaOrderView | null> {
  const addr = requireWalletAddress(privyUser);
  const pc = getBasePublicClient();
  const result = await pc.readContract({
    address: PAYSATS_DCA_ADDRESS,
    abi: paysatsDcaAbi,
    functionName: "orders",
    args: [addr],
  });
  const [
    amountPerSwap,
    interval,
    totalSwaps,
    executedSwaps,
    lastExecutedAt,
    minOutputBps,
    active,
  ] = result;
  if (!active) return null;
  const intervalSeconds = Number(interval);
  return {
    active,
    amountPerSwapRaw: amountPerSwap.toString(),
    amountPerSwapIdr: Number(amountPerSwap) / 10 ** IDRX_DECIMALS,
    intervalSeconds,
    intervalLabel: intervalLabel(intervalSeconds),
    totalSwaps: Number(totalSwaps),
    executedSwaps: Number(executedSwaps),
    lastExecutedAt: Number(lastExecutedAt),
    minOutputBps: Number(minOutputBps),
  };
}

export async function getAccountBalances(
  privyUser: User,
): Promise<AccountBalances> {
  const addr = requireWalletAddress(privyUser);
  const pc = getBasePublicClient();

  const idrxRaw = await pc.readContract({
    address: IDRX_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [addr],
  });

  let cbBtcRaw = BigInt(0);
  const btcAddr = process.env.NEXT_PUBLIC_BTC_ERC20_ADDRESS;
  if (btcAddr && isAddress(btcAddr)) {
    try {
      cbBtcRaw = await pc.readContract({
        address: getAddress(btcAddr),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addr],
      });
    } catch {
      cbBtcRaw = BigInt(0);
    }
  }

  return {
    walletAddress: addr,
    idrxRaw: idrxRaw.toString(),
    idrxAmount: Number(idrxRaw) / 10 ** IDRX_DECIMALS,
    cbBtcRaw: cbBtcRaw.toString(),
    cbBtcSats: Number(cbBtcRaw) / 10 ** (CBBTC_DECIMALS - 8), // sats = 1e-8 BTC
  };
}

/** Map a human DCA frequency to interval seconds. */
export function resolveIntervalSeconds(
  frequency: "daily" | "weekly" | "monthly",
): number {
  switch (frequency) {
    case "daily":
      return 86_400;
    case "weekly":
      return 604_800;
    case "monthly":
      return 2_592_000;
  }
}
