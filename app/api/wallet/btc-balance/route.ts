import { prisma } from "@/lib/prisma";
import {
  btcErc20TokenAddress,
  defaultPublicRpc,
  viemChainForNetworkChainId,
} from "@/lib/idrx-onchain";
import {
  getPreferredEthereumAddress,
  getPrivyUserFromRequest,
} from "@/services/privy/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
} from "viem";
import { erc20Abi } from "viem";

/**
 * Saldo token BTC on-chain (ERC-20, mis. cbBTC di Base) untuk dompet Privy.
 * Set `NEXT_PUBLIC_BTC_ERC20_ADDRESS`; desimal dibaca dari kontrak.
 */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = btcErc20TokenAddress();
  if (!token) {
    return NextResponse.json({
      configured: false,
      balanceRaw: null,
      balanceFormatted: null,
      symbol: "BTC",
      networkChainId:
        new URL(request.url).searchParams.get("networkChainId")?.trim() ||
        process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ||
        "8453",
      walletAddress: null,
      error: "Token BTC on-chain belum dikonfigurasi (NEXT_PUBLIC_BTC_ERC20_ADDRESS)",
    });
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
      configured: true,
      balanceRaw: null,
      balanceFormatted: null,
      symbol: "BTC",
      networkChainId,
      walletAddress: null,
      error: "Dompet tidak terdeteksi — kirim walletAddress dari klien",
    });
  }

  const chain = viemChainForNetworkChainId(networkChainId);
  const rpcUrl = defaultPublicRpc(networkChainId);

  try {
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const [rawBalance, decimals, sym] = await Promise.all([
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
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "symbol",
      }),
    ]);

    const balanceFormatted = formatUnits(rawBalance, decimals);

    return NextResponse.json({
      configured: true,
      balanceRaw: rawBalance.toString(),
      balanceFormatted,
      decimals,
      symbol: sym,
      networkChainId,
      walletAddress: wallet,
      tokenAddress: token,
      rpcUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error: "Gagal membaca saldo BTC on-chain",
        networkChainId,
        walletAddress: wallet,
        rpcUrl,
      },
      { status: 502 },
    );
  }
}
