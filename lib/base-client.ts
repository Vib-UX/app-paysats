import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

function makeClient() {
  const rpc = process.env.NEXT_PUBLIC_BASE_RPC_URL;
  return createPublicClient({
    chain: base,
    transport: http(rpc || undefined),
    batch: { multicall: true },
  });
}

type BaseClient = ReturnType<typeof makeClient>;

let _client: BaseClient | undefined;

/**
 * Singleton viem PublicClient for Base.
 * Reuses the same HTTP transport so viem can batch/deduplicate requests.
 */
export function getBasePublicClient(): BaseClient {
  if (!_client) {
    _client = makeClient();
  }
  return _client;
}
