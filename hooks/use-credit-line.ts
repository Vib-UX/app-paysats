"use client";

import {
  CBBTC_ADDRESS,
  CBBTC_USDC_MARKET_ID,
  CBBTC_USDC_MARKET_PARAMS,
  MORPHO_BLUE_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  borrowSharesToAssets,
  deriveCreditHealth,
  maxSafeBorrow,
  morphoBlueAbi,
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

      const borrowedAssets = borrowSharesToAssets(
        position.borrowShares,
        marketState.totalBorrowAssets,
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

export function useOpenCreditLine() {
  const smartWalletSend = useSmartWalletSendCalls();
  const smartAddr = useSmartWalletAddress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const open = useCallback(
    async (params: OpenCreditParams) => {
      setError(null);
      setTxHash(null);
      setBusy(true);

      try {
        if (!smartAddr) throw new Error("Smart wallet belum tersedia");

        const pc = getBasePublicClient();
        const balance = await pc.readContract({
          address: CBBTC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [smartAddr],
        });

        if (balance < params.collateralAmount) {
          const needed =
            Number(params.collateralAmount - balance) / 1e8;
          throw new Error(
            `Saldo cbBTC tidak cukup. Butuh ${needed.toFixed(8)} cbBTC lagi.`,
          );
        }

        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [MORPHO_BLUE_ADDRESS, params.collateralAmount],
        });

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

        const hash = await smartWalletSend([
          { to: CBBTC_ADDRESS, data: approveData, value: BigInt(0) },
          {
            to: MORPHO_BLUE_ADDRESS,
            data: supplyCollateralData,
            value: BigInt(0),
          },
          { to: MORPHO_BLUE_ADDRESS, data: borrowData, value: BigInt(0) },
        ]);

        setTxHash(hash);
        return hash;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Gagal membuka kredit";
        setError(msg);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [smartWalletSend, smartAddr],
  );

  return { open, busy, error, txHash };
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

        const isFullRepay = opts?.fullRepayShares != null;

        const approveAmount = isFullRepay
          ? BigInt(
              "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            )
          : repayAmount;

        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [MORPHO_BLUE_ADDRESS, approveAmount],
        });

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
          { to: USDC_ADDRESS, data: approveData, value: BigInt(0) },
          { to: MORPHO_BLUE_ADDRESS, data: repayData, value: BigInt(0) },
        ]);

        setTxHash(hash);
        return hash;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Gagal membayar pinjaman";
        setError(msg);
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
        const msg =
          e instanceof Error ? e.message : "Gagal menarik jaminan";
        setError(msg);
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
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatUsdc(amount: bigint, locale: string = "id-ID"): string {
  const n = Number(amount) / 10 ** USDC_DECIMALS;
  return n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

export function formatCbBtc(amount: bigint, locale: string = "id-ID"): string {
  const n = Number(amount) / 1e8;
  return n.toLocaleString(locale, { maximumFractionDigits: 8 });
}
