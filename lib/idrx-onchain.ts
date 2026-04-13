import { bsc, base, polygon } from "viem/chains";

/** IDRX (ERC-20) di Base mainnet — override lewat env jika mitra mengganti kontrak */
export const DEFAULT_IDRX_TOKEN_BASE =
  "0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22" as const;

export function idrxTokenAddress(): `0x${string}` {
  const raw =
    process.env.NEXT_PUBLIC_IDRX_TOKEN_ADDRESS ||
    process.env.IDRX_TOKEN_ADDRESS ||
    DEFAULT_IDRX_TOKEN_BASE;
  return raw as `0x${string}`;
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
