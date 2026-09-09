"use client";

import {
  PAYSATS_DCA_ADDRESS,
  IDRX_DECIMALS,
  IDRX_TOKEN_ADDRESS,
  paysatsDcaAbi,
  erc20Abi,
  type DcaExecution,
  type DcaOrder,
} from "@/lib/contracts/paysats-dca";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  type Address,
} from "viem";
import { getBasePublicClient } from "@/lib/base-client";
import { useT } from "@/lib/i18n";
import { resolveApiError } from "@/lib/resolve-api-error";

/** Smart wallet address (ERC-4337 contract) — primary on-chain identity. */
function useSmartWalletAddress(): Address | undefined {
  const { user } = usePrivy();
  const { client } = useSmartWallets();

  return useMemo(() => {
    const clientAddr = client?.account?.address;
    if (clientAddr && isAddress(clientAddr)) return getAddress(clientAddr);

    if (!user) return undefined;

    if (user.smartWallet?.address && isAddress(user.smartWallet.address)) {
      return getAddress(user.smartWallet.address);
    }

    for (const a of user.linkedAccounts ?? []) {
      if (a.type === "smart_wallet" && "address" in a) {
        const addr = (a as { address: string }).address;
        if (isAddress(addr)) return getAddress(addr);
      }
    }

    return undefined;
  }, [user, client]);
}

// ---------------------------------------------------------------------------
// Read active DCA order
// ---------------------------------------------------------------------------

export function useDcaOrder() {
  const t = useT();
  const address = useSmartWalletAddress();
  const [order, setOrder] = useState<DcaOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);

  const refetch = useCallback(async () => {
    if (!address) {
      setOrder(null);
      return;
    }
    const g = ++gen.current;
    setLoading(true);
    setError(null);
    try {
      const pc = getBasePublicClient();
      const result = await pc.readContract({
        address: PAYSATS_DCA_ADDRESS,
        abi: paysatsDcaAbi,
        functionName: "orders",
        args: [address],
      });
      if (g !== gen.current) return;
      const [
        amountPerSwap,
        interval,
        totalSwaps,
        executedSwaps,
        lastExecutedAt,
        minOutputBps,
        active,
      ] = result;
      const o: DcaOrder = {
        amountPerSwap,
        interval,
        totalSwaps,
        executedSwaps,
        lastExecutedAt,
        minOutputBps,
        active,
      };
      setOrder(o.active ? o : null);
    } catch (e) {
      if (g !== gen.current) return;
      setError(e instanceof Error ? e.message : t("error.dcaReadFailed"));
      setOrder(null);
    } finally {
      if (gen.current === g) setLoading(false);
    }
  }, [address, t]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { order, loading, error, refetch, address };
}

// ---------------------------------------------------------------------------
// Send helpers
// ---------------------------------------------------------------------------

type TxCall = { to: `0x${string}`; data: `0x${string}`; value: bigint };

function useSmartWalletSendCalls() {
  const { client: smartClient, getClientForChain } = useSmartWallets();
  const t = useT();

  return useCallback(
    async (calls: TxCall[]): Promise<string> => {
      if (smartClient) {
        return smartClient.sendTransaction({
          calls: calls as Parameters<typeof smartClient.sendTransaction>[0] extends { calls: infer C } ? C : never,
        });
      }

      const baseClient = await getClientForChain({ id: 8453 });
      if (baseClient) {
        return baseClient.sendTransaction({
          calls: calls as Parameters<typeof baseClient.sendTransaction>[0] extends { calls: infer C } ? C : never,
        });
      }

      throw new Error(t("error.smartWalletMissing"));
    },
    [smartClient, getClientForChain, t],
  );
}

// ---------------------------------------------------------------------------
// Create DCA order
//
// Smart wallet already holds IDRX (minted directly to it).
// Single UserOp: approve IDRX → createOrder.
// ---------------------------------------------------------------------------

export type CreateDcaParams = {
  amountPerSwap: bigint;
  interval: bigint;
  totalSwaps: bigint;
  minOutputBps?: bigint;
};

export function useCreateDcaOrder() {
  const t = useT();
  const smartWalletSend = useSmartWalletSendCalls();
  const smartAddr = useSmartWalletAddress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const create = useCallback(
    async (params: CreateDcaParams) => {
      setError(null);
      setTxHash(null);
      setBusy(true);

      try {
        if (!smartAddr) throw new Error(t("error.smartWalletMissing"));

        // For fixed swaps, require the full amount; for unlimited, just one swap
        const requiredIdrx =
          params.totalSwaps > BigInt(0)
            ? params.amountPerSwap * params.totalSwaps
            : params.amountPerSwap;

        const pc = getBasePublicClient();
        const smartBalance = await pc.readContract({
          address: IDRX_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [smartAddr],
        });

        if (smartBalance < requiredIdrx) {
          const needed = Number(requiredIdrx - smartBalance) / 10 ** IDRX_DECIMALS;
          throw new Error(
            t("error.dcaInsufficientIdrx", {
              amount: needed.toLocaleString("en-US", { maximumFractionDigits: 2 }),
            }),
          );
        }

        const approvalAmount =
          params.totalSwaps > BigInt(0)
            ? params.amountPerSwap * params.totalSwaps
            : BigInt(
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
              );

        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [PAYSATS_DCA_ADDRESS, approvalAmount],
        });

        const createOrderData = encodeFunctionData({
          abi: paysatsDcaAbi,
          functionName: "createOrder",
          args: [
            params.amountPerSwap,
            params.interval,
            params.totalSwaps,
            params.minOutputBps ?? BigInt(0),
          ],
        });

        const hash = await smartWalletSend([
          { to: IDRX_TOKEN_ADDRESS, data: approveData, value: BigInt(0) },
          { to: PAYSATS_DCA_ADDRESS, data: createOrderData, value: BigInt(0) },
        ]);

        setTxHash(hash);
        return hash;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : t("error.dcaCreateFailed");
        setError(msg);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [smartWalletSend, smartAddr, t],
  );

  return { create, busy, error, txHash };
}

// ---------------------------------------------------------------------------
// Cancel DCA order
// ---------------------------------------------------------------------------

export function useCancelDcaOrder() {
  const t = useT();
  const smartWalletSend = useSmartWalletSendCalls();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const cancelData = encodeFunctionData({
        abi: paysatsDcaAbi,
        functionName: "cancelOrder",
      });

      const hash = await smartWalletSend([
        { to: PAYSATS_DCA_ADDRESS, data: cancelData, value: BigInt(0) },
      ]);
      return hash;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("error.dcaCancelFailed"),
      );
      return null;
    } finally {
      setBusy(false);
    }
  }, [smartWalletSend, t]);

  return { cancel, busy, error };
}

// ---------------------------------------------------------------------------
// Fetch DCAExecuted events via server API (Basescan, no RPC block-range limit)
// ---------------------------------------------------------------------------

type ApiExecution = {
  idrxSpent: string;
  cbBTCReceived: string;
  blockNumber: string;
  transactionHash: string;
  timestamp: number;
};

export function useDcaExecutions() {
  const t = useT();
  const { getAccessToken, authenticated } = usePrivy();
  const [executions, setExecutions] = useState<DcaExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const refetch = useCallback(async () => {
    if (!authenticated) {
      setExecutions([]);
      return;
    }
    const g = ++gen.current;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessTokenRef.current();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/dca/executions", { headers });
      const json = (await res.json()) as {
        executions?: ApiExecution[];
        error?: string;
        errorKey?: string;
      };

      if (g !== gen.current) return;

      if (!res.ok || json.error) {
        setError(resolveApiError(json, t, "error.dcaHistoryFailed"));
        setExecutions([]);
        return;
      }

      const items: DcaExecution[] = (json.executions ?? []).map((e) => ({
        idrxSpent: BigInt(e.idrxSpent),
        cbBTCReceived: BigInt(e.cbBTCReceived),
        blockNumber: BigInt(e.blockNumber),
        transactionHash: e.transactionHash,
      }));

      setExecutions(items);
    } catch (e) {
      if (g !== gen.current) return;
      setError(e instanceof Error ? e.message : t("error.dcaHistoryFailed"));
      setExecutions([]);
    } finally {
      if (gen.current === g) setLoading(false);
    }
  }, [authenticated, t]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { executions, loading, error, refetch };
}
