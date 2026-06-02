import { prisma } from "@/lib/prisma";
import { getBasePublicClient } from "@/lib/base-client";
import {
  CBBTC_ADDRESS,
  CBBTC_USDC_MARKET_ID,
  CBBTC_USDC_MARKET_PARAMS,
  MORPHO_BLUE_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  CBBTC_DECIMALS,
  borrowSharesToAssets,
  deriveCreditHealth,
  maxSafeBorrow,
  morphoBlueAbi,
  morphoOracleAbi,
} from "@/lib/contracts/morpho-credit";
import { erc20Abi } from "@/lib/contracts/paysats-dca";
import {
  getPreferredEthereumAddress,
  getPrivyUserFromRequest,
} from "@/services/privy/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { formatUnits, getAddress, isAddress } from "viem";

export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const queryWallet = searchParams.get("walletAddress")?.trim() ?? "";

  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });

  let wallet: string | null = null;
  if (queryWallet) {
    if (!isAddress(queryWallet)) {
      return NextResponse.json(
        { error: "Alamat dompet tidak valid" },
        { status: 400 },
      );
    }
    wallet = getAddress(queryWallet);
  } else {
    wallet =
      getPreferredEthereumAddress(privyUser) ?? row?.walletAddress ?? null;
  }

  if (!wallet) {
    return NextResponse.json(
      { error: "Dompet tidak terdeteksi" },
      { status: 400 },
    );
  }

  try {
    const pc = getBasePublicClient();

    const [posResult, mktResult, priceResult, cbBtcBal, usdcBal] =
      await Promise.all([
        pc.readContract({
          address: MORPHO_BLUE_ADDRESS,
          abi: morphoBlueAbi,
          functionName: "position",
          args: [CBBTC_USDC_MARKET_ID, wallet as `0x${string}`],
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
          args: [wallet as `0x${string}`],
        }),
        pc.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet as `0x${string}`],
        }),
      ]);

    const [, borrowShares, collateral] = posResult;
    const [, , totalBorrowAssets, totalBorrowShares] = mktResult;

    const borrowedAssets = borrowSharesToAssets(
      BigInt(borrowShares),
      BigInt(totalBorrowAssets),
      BigInt(totalBorrowShares),
    );

    const health = deriveCreditHealth(
      BigInt(collateral),
      priceResult,
      borrowedAssets,
    );

    const maxBorrowVal = maxSafeBorrow(cbBtcBal, priceResult);

    const hasPosition = BigInt(collateral) > BigInt(0) || BigInt(borrowShares) > BigInt(0);

    return NextResponse.json({
      walletAddress: wallet,
      hasPosition,
      collateral: collateral.toString(),
      collateralFormatted: formatUnits(BigInt(collateral), CBBTC_DECIMALS),
      borrowShares: borrowShares.toString(),
      borrowedAssets: borrowedAssets.toString(),
      borrowedFormatted: formatUnits(borrowedAssets, USDC_DECIMALS),
      oraclePrice: priceResult.toString(),
      healthFactor: health.healthFactor,
      ltvPercent: health.ltvPercent,
      safetyZone: health.zone,
      safetyScore: health.safetyScore,
      maxBorrow: maxBorrowVal.toString(),
      maxBorrowFormatted: formatUnits(maxBorrowVal, USDC_DECIMALS),
      cbBtcBalance: cbBtcBal.toString(),
      cbBtcBalanceFormatted: formatUnits(cbBtcBal, CBBTC_DECIMALS),
      usdcBalance: usdcBal.toString(),
      usdcBalanceFormatted: formatUnits(usdcBal, USDC_DECIMALS),
    });
  } catch (e) {
    console.error("Credit position read error:", e);
    return NextResponse.json(
      { error: "Gagal membaca posisi kredit on-chain" },
      { status: 502 },
    );
  }
}
