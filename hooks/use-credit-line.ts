"use client";

import {
  CBBTC_ADDRESS,
  CBBTC_USDC_MARKET_ID,
  CBBTC_USDC_MARKET_PARAMS,
  MORPHO_BLUE_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  accrueInterestView,
  borrowSharesToAssets,
  deriveCreditHealth,
  maxSafeBorrow,
  morphoBlueAbi,
  morphoIrmAbi,
  morphoOracleAbi,
  type CreditHealth,
  type CreditPosition,
  type MarketState,
} from "@/lib/contracts/morpho-credit";
import { erc20Abi } from "@/lib/contracts/arka-dca";
import { getBasePublicClient } from "@/lib/base-client";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  type Address,
} from "viem";

// ---------------------------------------------------------------------------
// Smart wallet address (reuse the same pattern as use-dca-contract.ts)
// ---------------------------------------------------------------------------

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
// Smart wallet batched calls
// ---------------------------------------------------------------------------

type TxCall = { to: `0x${string}`; data: `0x${string}`; value: bigint };

function useSmartWalletSendCalls() {
  const { client: smartClient, getClientForChain } = useSmartWallets();

  return useCallback(
    async (calls: TxCall[]): Promise<string> => {
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
// Read credit position + market state + oracle price
// ---------------------------------------------------------------------------

export type CreditPositionData = {
  position: CreditPosition;
  marketState: MarketState;
  oraclePrice: bigint;
  borrowedAssets: bigint;
  health: CreditHealth;
  maxBorrow: bigint;
  cbBtcBalance: bigint;
  usdcBalance: bigint;
  borrowApyPercent: number;
};

export function useCreditPosition() {
  const address = useSmartWalletAddress();
  const [data, setData] = useState<CreditPositionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gen = useRef(0);

  const refetch = useCallback(async () => {
    if (!address) {
      setData(null);
      return;
    }
    const g = ++gen.current;
    setLoading(true);
    setError(null);
    try {
      const pc = getBasePublicClient();

      const [posResult, mktResult, priceResult, cbBtcBal, usdcBal] =
        await Promise.all([
          pc.readContract({
            address: MORPHO_BLUE_ADDRESS,
            abi: morphoBlueAbi,
            functionName: "position",
            args: [CBBTC_USDC_MARKET_ID, address],
          }),
          pc.readContract({
            address: MORPHO_BLUE_ADDRESS,
            abi: morphoBlueAbi,
            functionName: "market",
            args: [CBBTC_USDC_MARKET_ID],
          }),
          pc.readContract({
            address: CBBTC_USDC_MARKET_PARAMS.oracle,
            abi: morphoOracleAbi,
            functionName: "price",
          }),
          pc.readContract({
            address: CBBTC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
          pc.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }),
        ]);

      if (g !== gen.current) return;

      const [supplyShares, borrowShares, collateral] = posResult;
      const position: CreditPosition = {
        supplyShares,
        borrowShares: BigInt(borrowShares),
        collateral: BigInt(collateral),
      };

      const [
        totalSupplyAssets,
        totalSupplyShares,
        totalBorrowAssets,
        totalBorrowShares,
        lastUpdate,
        fee,
      ] = mktResult;
      const marketState: MarketState = {
        totalSupplyAssets: BigInt(totalSupplyAssets),
        totalSupplyShares: BigInt(totalSupplyShares),
        totalBorrowAssets: BigInt(totalBorrowAssets),
        totalBorrowShares: BigInt(totalBorrowShares),
        lastUpdate: BigInt(lastUpdate),
        fee: BigInt(fee),
      };

      const oraclePrice = priceResult;

      // Fetch the IRM borrow rate and accrue interest client-side
      // so the debt reflects real-time interest, not just last on-chain update.
      let accruedTotalBorrowAssets = marketState.totalBorrowAssets;
      let borrowApyPercent = 0;
      try {
        const mktTuple = {
          totalSupplyAssets: marketState.totalSupplyAssets,
          totalSupplyShares: marketState.totalSupplyShares,
          totalBorrowAssets: marketState.totalBorrowAssets,
          totalBorrowShares: marketState.totalBorrowShares,
          lastUpdate: marketState.lastUpdate,
          fee: marketState.fee,
        };
        const borrowRate = await pc.readContract({
          address: CBBTC_USDC_MARKET_PARAMS.irm,
          abi: morphoIrmAbi,
          functionName: "borrowRateView",
          args: [CBBTC_USDC_MARKET_PARAMS, mktTuple],
        });
        const rateWad = BigInt(borrowRate);
        accruedTotalBorrowAssets = accrueInterestView(
          marketState.totalBorrowAssets,
          marketState.lastUpdate,
          rateWad,
        );
        const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
        borrowApyPercent =
          (Number(rateWad) / 1e18) * SECONDS_PER_YEAR * 100;
      } catch {
        // Fall back to stale on-chain value if IRM call fails
      }

      const borrowedAssets = borrowSharesToAssets(
        position.borrowShares,
        accruedTotalBorrowAssets,
        marketState.totalBorrowShares,
      );

      const health = deriveCreditHealth(
        position.collateral,
        oraclePrice,
        borrowedAssets,
      );

      const maxBorrowVal = maxSafeBorrow(cbBtcBal, oraclePrice);

      setData({
        position,
        marketState,
        oraclePrice,
        borrowedAssets,
        health,
        maxBorrow: maxBorrowVal,
        cbBtcBalance: cbBtcBal,
        usdcBalance: usdcBal,
        borrowApyPercent,
      });
    } catch (e) {
      if (g !== gen.current) return;
      setError(
        e instanceof Error ? e.message : "Gagal membaca posisi kredit",
      );
      setData(null);
    } finally {
      if (gen.current === g) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch, address };
}

// ---------------------------------------------------------------------------
// Open credit line: approve cbBTC → supplyCollateral → borrow USDC
// ---------------------------------------------------------------------------

export type OpenCreditParams = {
  collateralAmount: bigint;
  borrowAmount: bigint;
};

const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);

function humaniseError(e: unknown, fallback: string): string {
  if (!(e instanceof Error)) return fallback;
  const msg = e.message;
  if (msg.includes("insufficient") && msg.toLowerCase().includes("balance"))
    return "Saldo tidak cukup untuk transaksi ini.";
  if (msg.includes("transfer reverted"))
    return "Transfer token gagal — coba lagi nanti.";
  if (msg.includes("UserOperation reverted"))
    return "Transaksi gagal saat simulasi — coba lagi nanti.";
  if (msg.includes("User rejected") || msg.includes("denied"))
    return "Transaksi dibatalkan.";
  if (msg.length > 120) return `${fallback} (${msg.slice(0, 80)}…)`;
  return msg;
}

export function useOpenCreditLine() {
  const smartWalletSend = useSmartWalletSendCalls();
  const smartAddr = useSmartWalletAddress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockTxHash, setLockTxHash] = useState<string | null>(null);
  const [borrowTxHash, setBorrowTxHash] = useState<string | null>(null);

  const open = useCallback(
    async (params: OpenCreditParams) => {
      setError(null);
      setLockTxHash(null);
      setBorrowTxHash(null);
      setBusy(true);

      try {
        if (!smartAddr) throw new Error("Smart wallet belum tersedia");

        const pc = getBasePublicClient();
        const [balance, currentAllowance] = await Promise.all([
          pc.readContract({
            address: CBBTC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [smartAddr],
          }),
          pc.readContract({
            address: CBBTC_ADDRESS,
            abi: erc20Abi,
            functionName: "allowance",
            args: [smartAddr, MORPHO_BLUE_ADDRESS],
          }),
        ]);

        if (balance < params.collateralAmount) {
          const needed =
            Number(params.collateralAmount - balance) / 1e8;
          throw new Error(
            `Saldo cbBTC tidak cukup. Butuh ${needed.toFixed(8)} cbBTC lagi.`,
          );
        }

        // Send approve / supplyCollateral / borrow as three SEPARATE
        // ERC-4337 UserOps rather than one batched UserOp.
        //
        // We tried batching them into a single UserOp and it consistently
        // failed gas estimation on the bundler — the combined call was
        // either rejected during simulation or landed with an insufficient
        // gas limit on-chain. Splitting the steps keeps each UserOp well
        // within the bundler's estimation envelope.
        //
        // Trade-off: if the borrow UserOp fails after collateral is already
        // supplied, the user ends up with locked collateral and no USDC.
        // That recovery case is handled by `useBorrowAgainstCollateral` +
        // the `FinishBorrowCard` UI in features/credit/credit-client.tsx,
        // which lets the user complete the borrow against the already-
        // locked collateral.

        if (currentAllowance < params.collateralAmount) {
          const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [MORPHO_BLUE_ADDRESS, MAX_UINT256],
          });
          await smartWalletSend([
            { to: CBBTC_ADDRESS, data: approveData, value: BigInt(0) },
          ]);
        }

        const supplyCollateralData = encodeFunctionData({
          abi: morphoBlueAbi,
          functionName: "supplyCollateral",
          args: [
            CBBTC_USDC_MARKET_PARAMS,
            params.collateralAmount,
            smartAddr,
            "0x",
          ],
        });
        const lockHash = await smartWalletSend([
          {
            to: MORPHO_BLUE_ADDRESS,
            data: supplyCollateralData,
            value: BigInt(0),
          },
        ]);
        setLockTxHash(lockHash);

        const borrowData = encodeFunctionData({
          abi: morphoBlueAbi,
          functionName: "borrow",
          args: [
            CBBTC_USDC_MARKET_PARAMS,
            params.borrowAmount,
            BigInt(0),
            smartAddr,
            smartAddr,
          ],
        });
        const borrowHash = await smartWalletSend([
          { to: MORPHO_BLUE_ADDRESS, data: borrowData, value: BigInt(0) },
        ]);
        setBorrowTxHash(borrowHash);

        return { lockTxHash: lockHash, borrowTxHash: borrowHash };
      } catch (e) {
        setError(humaniseError(e, "Gagal membuka kredit"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [smartWalletSend, smartAddr],
  );

  return { open, busy, error, lockTxHash, borrowTxHash };
}

// ---------------------------------------------------------------------------
// Borrow-only recovery: draw USDC against already-locked collateral.
// Useful when a previous open flow supplied collateral but the borrow step
// never landed (pre-batching bug, dropped UserOp, page closed mid-flow, etc).
// ---------------------------------------------------------------------------

export function useBorrowAgainstCollateral() {
  const smartWalletSend = useSmartWalletSendCalls();
  const smartAddr = useSmartWalletAddress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const borrow = useCallback(
    async (borrowAmount: bigint) => {
      setError(null);
      setTxHash(null);
      setBusy(true);

      try {
        if (!smartAddr) throw new Error("Smart wallet belum tersedia");
        if (borrowAmount <= BigInt(0))
          throw new Error("Nominal pinjaman tidak valid.");

        const borrowData = encodeFunctionData({
          abi: morphoBlueAbi,
          functionName: "borrow",
          args: [
            CBBTC_USDC_MARKET_PARAMS,
            borrowAmount,
            BigInt(0),
            smartAddr,
            smartAddr,
          ],
        });

        const hash = await smartWalletSend([
          { to: MORPHO_BLUE_ADDRESS, data: borrowData, value: BigInt(0) },
        ]);

        setTxHash(hash);
        return hash;
      } catch (e) {
        setError(humaniseError(e, "Gagal menarik USDC"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [smartWalletSend, smartAddr],
  );

  return { borrow, busy, error, txHash };
}

// ---------------------------------------------------------------------------
// Repay credit line: approve USDC → repay Morpho
// ---------------------------------------------------------------------------

export function useRepayCreditLine() {
  const smartWalletSend = useSmartWalletSendCalls();
  const smartAddr = useSmartWalletAddress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const repay = useCallback(
    async (
      repayAmount: bigint,
      opts?: { fullRepayShares?: bigint },
    ) => {
      setError(null);
      setTxHash(null);
      setBusy(true);

      try {
        if (!smartAddr) throw new Error("Smart wallet belum tersedia");

        const pc = getBasePublicClient();
        const [currentAllowance, usdcBal] = await Promise.all([
          pc.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "allowance",
            args: [smartAddr, MORPHO_BLUE_ADDRESS],
          }),
          pc.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [smartAddr],
          }),
        ]);

        const isFullRepay = opts?.fullRepayShares != null;

        if (!isFullRepay && usdcBal < repayAmount) {
          throw new Error("Saldo USDC tidak cukup.");
        }

        if (currentAllowance < (isFullRepay ? MAX_UINT256 : repayAmount)) {
          const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [MORPHO_BLUE_ADDRESS, MAX_UINT256],
          });
          await smartWalletSend([
            { to: USDC_ADDRESS, data: approveData, value: BigInt(0) },
          ]);
        }

        const repayData = encodeFunctionData({
          abi: morphoBlueAbi,
          functionName: "repay",
          args: isFullRepay
            ? [
                CBBTC_USDC_MARKET_PARAMS,
                BigInt(0),
                opts!.fullRepayShares!,
                smartAddr,
                "0x",
              ]
            : [CBBTC_USDC_MARKET_PARAMS, repayAmount, BigInt(0), smartAddr, "0x"],
        });

        const hash = await smartWalletSend([
          { to: MORPHO_BLUE_ADDRESS, data: repayData, value: BigInt(0) },
        ]);

        setTxHash(hash);
        return hash;
      } catch (e) {
        setError(humaniseError(e, "Gagal membayar pinjaman"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [smartWalletSend, smartAddr],
  );

  return { repay, busy, error, txHash };
}

// ---------------------------------------------------------------------------
// Withdraw collateral (after full repay)
// ---------------------------------------------------------------------------

export function useWithdrawCollateral() {
  const smartWalletSend = useSmartWalletSendCalls();
  const smartAddr = useSmartWalletAddress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const withdraw = useCallback(
    async (amount: bigint) => {
      setError(null);
      setTxHash(null);
      setBusy(true);

      try {
        if (!smartAddr) throw new Error("Smart wallet belum tersedia");

        const withdrawData = encodeFunctionData({
          abi: morphoBlueAbi,
          functionName: "withdrawCollateral",
          args: [CBBTC_USDC_MARKET_PARAMS, amount, smartAddr, smartAddr],
        });

        const hash = await smartWalletSend([
          { to: MORPHO_BLUE_ADDRESS, data: withdrawData, value: BigInt(0) },
        ]);

        setTxHash(hash);
        return hash;
      } catch (e) {
        setError(humaniseError(e, "Gagal menarik jaminan"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [smartWalletSend, smartAddr],
  );

  return { withdraw, busy, error, txHash };
}

// ---------------------------------------------------------------------------
// Credit loan persistence (DB-backed history)
// ---------------------------------------------------------------------------

export type CreditLoanRecord = {
  id: string;
  walletAddress: string;
  collateralRaw: string;
  borrowRaw: string;
  lockTxHash: string;
  borrowTxHash: string;
  settleTxHash: string | null;
  status: "active" | "fulfilled";
  openedAt: string;
  settledAt: string | null;
};

export function useCreditLoans() {
  const { getAccessToken } = usePrivy();
  const [loans, setLoans] = useState<CreditLoanRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/credit/loan", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setLoans(json.loans ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { loans, loading, refetch };
}

export function useCreateCreditLoan() {
  const { getAccessToken } = usePrivy();

  return useCallback(
    async (params: {
      walletAddress: string;
      collateralRaw: string;
      borrowRaw: string;
      lockTxHash: string;
      borrowTxHash: string;
    }) => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/credit/loan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(params),
        });
        if (res.ok) {
          const json = await res.json();
          return json.loan as CreditLoanRecord;
        }
      } catch {
        // silent
      }
      return null;
    },
    [getAccessToken],
  );
}

export function useSettleCreditLoan() {
  const { getAccessToken } = usePrivy();

  return useCallback(
    async (loanId: string, settleTxHash: string) => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/credit/loan", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ loanId, settleTxHash }),
        });
        if (res.ok) {
          const json = await res.json();
          return json.loan as CreditLoanRecord;
        }
      } catch {
        // silent
      }
      return null;
    },
    [getAccessToken],
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatUsdc(amount: bigint, locale: string = "id-ID"): string {
  const n = Number(amount) / 10 ** USDC_DECIMALS;
  return n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function formatCbBtc(amount: bigint, locale: string = "id-ID"): string {
  const n = Number(amount) / 1e8;
  return n.toLocaleString(locale, { maximumFractionDigits: 8 });
}
