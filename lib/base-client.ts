import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

let _client: ReturnType<typeof createPublicClient> | null = null;

/**
 * Singleton viem PublicClient for Base.
 * Reuses the same HTTP transport so viem can batch/deduplicate requests.
 */
export function getBasePublicClient() {
  if (!_client) {
    const rpc = process.env.NEXT_PUBLIC_BASE_RPC_URL;
    _client = createPublicClient({
      chain: base,
      transport: http(rpc || undefined),
      batch: { multicall: true },
    });
  }
  return _client;
}
