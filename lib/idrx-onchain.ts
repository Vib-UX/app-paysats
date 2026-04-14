import { getAddress, isAddress } from "viem";
import { bsc, base, polygon } from "viem/chains";

/** IDRX (ERC-20) di Base mainnet — override lewat env jika mitra mengganti kontrak */
export const DEFAULT_IDRX_TOKEN_BASE =
  "0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22" as const;

/**
 * Satu alamat EVM valid dari env (toleran spasi / salin ganda seperti * `0xabc…0xabc…`).
 */
export function parseOptionalEvmAddress(
  raw: string | undefined | null,
): `0x${string}` | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;
  if (isAddress(s)) return getAddress(s) as `0x${string}`;
  const m = s.match(/0x[a-fA-F0-9]{40}/);
  if (m?.[0] && isAddress(m[0])) {
    return getAddress(m[0]) as `0x${string}`;
  }
  return null;
}

export function idrxTokenAddress(): `0x${string}` {
  const raw =
    process.env.NEXT_PUBLIC_IDRX_TOKEN_ADDRESS ||
    process.env.IDRX_TOKEN_ADDRESS ||
    "";
  const parsed = parseOptionalEvmAddress(raw);
  if (parsed) return parsed;
  return DEFAULT_IDRX_TOKEN_BASE;
}

/** Wrapped BTC (mis. cbBTC) di Base — opsional; baca desimal dari kontrak. */
export function btcErc20TokenAddress(): `0x${string}` | null {
  const raw =
    process.env.NEXT_PUBLIC_BTC_ERC20_ADDRESS ??
    process.env.BTC_ERC20_ADDRESS ??
    "";
  return parseOptionalEvmAddress(raw);
}

export function viemChainForNetworkChainId(networkChainId: string) {
  switch (networkChainId) {
    case "8453":
      return base;
    case "137":
      return polygon;
    case "56":
      return bsc;
    default:
      return base;
  }
}

export function defaultPublicRpc(networkChainId: string): string {
  const custom = process.env.BASE_RPC_URL;
  if (networkChainId === "8453" && custom) return custom;
  const chain = viemChainForNetworkChainId(networkChainId);
  return chain.rpcUrls.default.http[0];
}
