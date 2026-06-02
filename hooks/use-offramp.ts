"use client";

import { erc20Abi } from "@/lib/contracts/paysats-dca";
import { USDC_ADDRESS, USDC_DECIMALS } from "@/lib/contracts/morpho-credit";
import type { OfframpSettlement } from "@/services/idrx/offramp-settlement";
import type { DestinationKind } from "@/services/idrx/payout-methods";
import type {
  IdrxBankMethod,
  IdrxDepositRedeemRecord,
} from "@/services/idrx/types";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  parseUnits,
  type Address,
} from "viem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayoutDestinationView = {
  id: string;
  idrxId: number;
  kind: DestinationKind;
  bankCode: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumberLast: string;
  depositWalletAddress: string;
  maxAmountTransfer: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClassifiedMethod = IdrxBankMethod & { kind: DestinationKind };

export type RedeemRateQuote = {
  source: "idrx" | "fallback";
  usdAmount: number;
  expectedIdr: number;
  grossIdr: number;
  feeIdr: number;
  rate: number;
};

export type RedeemRecord = IdrxDepositRedeemRecord & {
  settlement: OfframpSettlement;
};

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

/** IDRX cap on partner-stablecoin redeems (per transaction, real-time). */
export const MIN_REDEEM_USD = 2;
export const MAX_REDEEM_USD = 5_555;

function useAuthFetch() {
  const { getAccessToken } = usePrivy();
  return useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const token = await getAccessToken();
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [getAccessToken],
  );
}

function useSmartWalletAddress(): Address | undefined {
  const { user } = usePrivy();
  const { client } = useSmartWallets();

  // React Compiler handles memoization; avoid an explicit useMemo to keep the
  // eslint `react-hooks/preserve-manual-memoization` rule happy.
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
}

type TxCall = { to: `0x${string}`; data: `0x${string}`; value: bigint };

function useSmartWalletSendCalls() {
  const { client: smartClient, getClientForChain } = useSmartWallets();

  return useCallback(
    async (calls: TxCall[]): Promise<`0x${string}`> => {
      if (smartClient) {
        return smartClient.sendTransaction({
          calls: calls as Parameters<
            typeof smartClient.sendTransaction
          >[0] extends { calls: infer C }
            ? C
            : never,
        });
      }

      const baseClient = await getClientForChain({ id: 8453 });
      if (baseClient) {
        return baseClient.sendTransaction({
          calls: calls as Parameters<
            typeof baseClient.sendTransaction
          >[0] extends { calls: infer C }
            ? C
            : never,
        });
      }

      throw new Error("Smart wallet client tidak tersedia");
    },
    [smartClient, getClientForChain],
  );
}

// ---------------------------------------------------------------------------
// Payout destinations: list / add / delete / set-default
// ---------------------------------------------------------------------------

export function usePayoutDestinations() {
  const authFetch = useAuthFetch();
  const [destinations, setDestinations] = useState<PayoutDestinationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/idrx/destinations");
      const json = (await res.json().catch(() => ({}))) as {
        destinations?: PayoutDestinationView[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Gagal memuat tujuan payout");
        return;
      }
      setDestinations(json.destinations ?? []);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const add = useCallback(
    async (input: {
      kind: DestinationKind;
      bankCode: string;
      bankAccountNumber: string;
    }): Promise<{ ok: true; destination: PayoutDestinationView } | { ok: false; error: string }> => {
      const res = await authFetch("/api/idrx/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res.json().catch(() => ({}))) as {
        destination?: PayoutDestinationView;
        error?: string;
      };
      if (!res.ok || !json.destination) {
        return { ok: false, error: json.error ?? "Gagal menambah tujuan" };
      }
      await refetch();
      return { ok: true, destination: json.destination };
    },
    [authFetch, refetch],
  );

  const remove = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await authFetch(
        `/api/idrx/destinations/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        return { ok: false, error: json.error ?? "Gagal menghapus" };
      }
      await refetch();
      return { ok: true };
    },
    [authFetch, refetch],
  );

  const setDefault = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await authFetch(
        `/api/idrx/destinations/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        return { ok: false, error: json.error ?? "Gagal mengubah default" };
      }
      await refetch();
      return { ok: true };
    },
    [authFetch, refetch],
  );

  return { destinations, loading, error, refetch, add, remove, setDefault };
}

// ---------------------------------------------------------------------------
// Bank / e-wallet method catalogue
// ---------------------------------------------------------------------------

export function useBankMethods(kind: DestinationKind | "all" = "all") {
  const authFetch = useAuthFetch();
  const [methods, setMethods] = useState<ClassifiedMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(
          `/api/idrx/bank-methods?kind=${encodeURIComponent(kind)}`,
        );
        const json = (await res.json().catch(() => ({}))) as {
          methods?: ClassifiedMethod[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat daftar bank");
          return;
        }
        setMethods(json.methods ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, kind]);

  return { methods, loading, error };
}

// ---------------------------------------------------------------------------
// Rate quote (debounced)
// ---------------------------------------------------------------------------

export function useRedeemRate(usdAmount: number) {
  const authFetch = useAuthFetch();
  const [quote, setQuote] = useState<RedeemRateQuote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await authFetch(
          `/api/idrx/redeem-rate?usdAmount=${encodeURIComponent(
            usdAmount.toFixed(2),
          )}`,
        );
        const json = (await res.json().catch(() => ({}))) as
          | RedeemRateQuote
          | { error: string };
        if (cancelled) return;
        if (!res.ok || !("expectedIdr" in json)) {
          setQuote(null);
          return;
        }
        setQuote(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [authFetch, usdAmount]);

  return { quote, loading };
}

// ---------------------------------------------------------------------------
// Redeem: USDC transfer from smart wallet to deposit address + local snapshot
// ---------------------------------------------------------------------------

function humaniseError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const msg = e.message;
  if (msg.includes("insufficient") && msg.toLowerCase().includes("balance")) {
    return "Saldo USDC tidak cukup.";
  }
  if (msg.includes("User rejected") || msg.includes("denied")) {
    return "Transaksi dibatalkan.";
  }
  if (msg.length > 140) return `${fallback} (${msg.slice(0, 100)}…)`;
  return msg;
}

export function useRedeemUsdc() {
  const authFetch = useAuthFetch();
  const send = useSmartWalletSendCalls();
  const smartAddr = useSmartWalletAddress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const redeem = useCallback(
    async (params: {
      destination: PayoutDestinationView;
      usdAmount: number;
      idrQuoteRaw?: string;
    }) => {
      setError(null);
      setTxHash(null);

      if (!smartAddr) {
        setError("Smart wallet belum tersedia");
        return null;
      }
      if (!isAddress(params.destination.depositWalletAddress)) {
        setError("Alamat deposit IDRX tidak valid");
        return null;
      }
      if (
        params.usdAmount < MIN_REDEEM_USD ||
        params.usdAmount > MAX_REDEEM_USD
      ) {
        setError(
          `Nominal harus antara $${MIN_REDEEM_USD} dan $${MAX_REDEEM_USD}`,
        );
        return null;
      }

      setBusy(true);
      try {
        const amountRaw = parseUnits(
          params.usdAmount.toFixed(USDC_DECIMALS),
          USDC_DECIMALS,
        );
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [
            getAddress(params.destination.depositWalletAddress),
            amountRaw,
          ],
        });
        const hash = await send([
          { to: USDC_ADDRESS, data, value: BigInt(0) },
        ]);

        setTxHash(hash);

        await authFetch("/api/credit/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payoutDestinationId: params.destination.id,
            transferTxHash: hash,
            walletAddress: smartAddr,
            usdcAmountRaw: amountRaw.toString(),
            idrQuoteRaw: params.idrQuoteRaw,
          }),
        }).catch(() => {
          // non-fatal — polling will still correlate by transferTxHash
        });

        return hash;
      } catch (e) {
        setError(humaniseError(e, "Gagal mengirim USDC"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [authFetch, send, smartAddr],
  );

  return { redeem, busy, error, txHash, smartAddr };
}

// ---------------------------------------------------------------------------
// Redeem history polling
// ---------------------------------------------------------------------------

export function useRedeemHistory(opts?: { pollMs?: number }) {
  const authFetch = useAuthFetch();
  const [records, setRecords] = useState<RedeemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/idrx/redeems?page=1&take=20");
      const json = (await res.json().catch(() => ({}))) as {
        records?: RedeemRecord[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Gagal memuat riwayat redeem");
        return;
      }
      setRecords(json.records ?? []);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Auto-poll while any record is non-terminal.
  useEffect(() => {
    const interval = opts?.pollMs ?? 15_000;
    const hasPending = records.some((r) => !r.settlement.terminal);
    if (!hasPending) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(() => {
      void refetch();
    }, interval);
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [records, refetch, opts?.pollMs]);

  return { records, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatIdr(
  n: number | string | null | undefined,
  locale: string = "id-ID",
): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  return `Rp ${num.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
}

export function formatUsd(n: number, locale: string = "en-US"): string {
  return `$${n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
