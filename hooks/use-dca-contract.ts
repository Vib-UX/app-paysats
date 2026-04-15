"use client";

import {
  ARKA_DCA_ADDRESS,
  IDRX_DECIMALS,
  IDRX_TOKEN_ADDRESS,
  arkaDcaAbi,
  erc20Abi,
  type DcaExecution,
  type DcaOrder,
} from "@/lib/contracts/arka-dca";
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
        address: ARKA_DCA_ADDRESS,
        abi: arkaDcaAbi,
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
      setError(e instanceof Error ? e.message : "Gagal membaca order DCA");
      setOrder(null);
    } finally {
      if (gen.current === g) setLoading(false);
    }
  }, [address]);

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

      throw new Error("Smart wallet client tidak tersedia");
    },
    [smartClient, getClientForChain],
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
        if (!smartAddr) throw new Error("Smart wallet belum tersedia");

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
            `Saldo IDRX di smart wallet tidak cukup. Butuh ${needed.toLocaleString("id-ID")} IDRX lagi. Mint lebih banyak IDRX terlebih dahulu.`,
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
          args: [ARKA_DCA_ADDRESS, approvalAmount],
        });

        const createOrderData = encodeFunctionData({
          abi: arkaDcaAbi,
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
          { to: ARKA_DCA_ADDRESS, data: createOrderData, value: BigInt(0) },
        ]);

        setTxHash(hash);
        return hash;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Gagal membuat order DCA";
        setError(msg);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [smartWalletSend, smartAddr],
  );

  return { create, busy, error, txHash };
}

// ---------------------------------------------------------------------------
// Cancel DCA order
// ---------------------------------------------------------------------------

export function useCancelDcaOrder() {
  const smartWalletSend = useSmartWalletSendCalls();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const cancelData = encodeFunctionData({
        abi: arkaDcaAbi,
        functionName: "cancelOrder",
      });

      const hash = await smartWalletSend([
        { to: ARKA_DCA_ADDRESS, data: cancelData, value: BigInt(0) },
      ]);
      return hash;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal membatalkan order DCA",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }, [smartWalletSend]);

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
      };

      if (g !== gen.current) return;

      if (!res.ok || json.error) {
        setError(json.error ?? "Gagal memuat riwayat swap");
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
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat swap");
      setExecutions([]);
    } finally {
      if (gen.current === g) setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { executions, loading, error, refetch };
}
