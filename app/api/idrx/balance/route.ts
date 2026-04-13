import { prisma } from "@/lib/prisma";
import {
  defaultPublicRpc,
  idrxTokenAddress,
  viemChainForNetworkChainId,
} from "@/lib/idrx-onchain";
import {
  getPreferredEthereumAddress,
  getPrivyUserFromRequest,
} from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createPublicClient, formatUnits, getAddress, http, isAddress } from "viem";
import { erc20Abi } from "viem";

/**
 * Saldo IDRX on-chain (ERC-20) untuk dompet pengguna.
 * - `walletAddress`: alamat dari klien (Privy). Hanya perlu **valid EVM** + sesi login —
 *   saldo token di chain bersifat publik; objek User di server sering tidak selaras dengan klien.
 * - Tanpa query: pakai alamat dari token Privy / DB.
 * RPC Base: `BASE_RPC_URL` (mis. https://1rpc.io/base).
 */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const networkChainId =
    searchParams.get("networkChainId")?.trim() ||
    process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ||
    "8453";
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
    return NextResponse.json({
      balanceRaw: null,
      balanceFormatted: null,
      symbol: "IDRX",
      networkChainId,
      walletAddress: null,
      error: "Dompet tidak terdeteksi — kirim walletAddress dari klien",
    });
  }

  const chain = viemChainForNetworkChainId(networkChainId);
  const token = idrxTokenAddress();
  const rpcUrl = defaultPublicRpc(networkChainId);

  try {
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const [rawBalance, decimals] = await Promise.all([
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet as `0x${string}`],
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);

    const balanceFormatted = formatUnits(rawBalance, decimals);

    return NextResponse.json({
      balanceRaw: rawBalance.toString(),
      balanceFormatted,
      decimals,
      symbol: "IDRX",
      networkChainId,
      walletAddress: wallet,
      tokenAddress: token,
      rpcUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error: "Gagal membaca saldo on-chain",
        networkChainId,
        walletAddress: wallet,
        rpcUrl,
      },
      { status: 502 },
    );
  }
}
