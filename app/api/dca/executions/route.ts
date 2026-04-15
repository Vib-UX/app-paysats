import {
  ARKA_DCA_ADDRESS,
  arkaDcaAbi,
} from "@/lib/contracts/arka-dca";
import {
  getPreferredEthereumAddress,
  getPrivyUserFromRequest,
} from "@/services/privy/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { getBasePublicClient } from "@/lib/base-client";

const MAX_BLOCK_RANGE = BigInt(9);
const BLOCKS_PER_SECOND = 0.5;

/**
 * GET /api/dca/executions
 *
 * Fetches DCAExecuted events for the user. Because Alchemy free tier limits
 * eth_getLogs to 10-block ranges, we read the on-chain order to find
 * executedSwaps + interval + lastExecutedAt, then calculate approximate
 * blocks for each execution and search narrow 10-block windows.
 */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = getPreferredEthereumAddress(privyUser);
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Wallet tidak ditemukan" }, { status: 400 });
  }

  const addr = getAddress(wallet) as `0x${string}`;

  try {
    const pc = getBasePublicClient();
    const [currentBlock, orderResult] = await Promise.all([
      pc.getBlockNumber(),
      pc.readContract({
        address: ARKA_DCA_ADDRESS,
        abi: arkaDcaAbi,
        functionName: "orders",
        args: [addr],
      }),
    ]);

    const executedSwaps = Number(orderResult[3]);
    const lastExecutedAt = Number(orderResult[4]);
    const interval = Number(orderResult[1]);

    if (executedSwaps === 0 || lastExecutedAt === 0) {
      return NextResponse.json({ executions: [] });
    }

    const nowTs = Math.floor(Date.now() / 1000);

    const executionTimestamps: number[] = [];
    for (let i = 0; i < executedSwaps; i++) {
      const ts = lastExecutedAt - (executedSwaps - 1 - i) * interval;
      executionTimestamps.push(ts);
    }

    const executions: {
      idrxSpent: string;
      cbBTCReceived: string;
      blockNumber: string;
      transactionHash: string;
      timestamp: number;
    }[] = [];

    for (const ts of executionTimestamps) {
      const secsAgo = nowTs - ts;
      const blocksAgo = Math.ceil(secsAgo * BLOCKS_PER_SECOND);
      const estimatedBlock = Number(currentBlock) - blocksAgo;

      const fromBlock = BigInt(Math.max(0, estimatedBlock - 100));
      const toBlock = BigInt(estimatedBlock + 100);

      const found = await searchInChunks(pc, addr, fromBlock, toBlock);
      for (const log of found) {
        if (!executions.some((e) => e.transactionHash === log.transactionHash)) {
          executions.push(log);
        }
      }
    }

    executions.sort((a, b) => {
      const blockA = parseInt(a.blockNumber, 16);
      const blockB = parseInt(b.blockNumber, 16);
      return blockB - blockA;
    });

    return NextResponse.json({ executions });
  } catch (e) {
    console.error("DCA executions error:", e);
    return NextResponse.json(
      { error: "Gagal memuat riwayat swap" },
      { status: 502 },
    );
  }
}

async function searchInChunks(
  pc: ReturnType<typeof getBasePublicClient>,
  user: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
) {
  const results: {
    idrxSpent: string;
    cbBTCReceived: string;
    blockNumber: string;
    transactionHash: string;
    timestamp: number;
  }[] = [];

  for (let start = fromBlock; start <= toBlock; start += MAX_BLOCK_RANGE + BigInt(1)) {
    const end =
      start + MAX_BLOCK_RANGE > toBlock ? toBlock : start + MAX_BLOCK_RANGE;
    try {
      const logs = await pc.getContractEvents({
        address: ARKA_DCA_ADDRESS,
        abi: arkaDcaAbi,
        eventName: "DCAExecuted",
        args: { user },
        fromBlock: start,
        toBlock: end,
      });

      for (const log of logs) {
        const args = log.args as {
          user: string;
          idrxSpent: bigint;
          cbBTCReceived: bigint;
        };
        results.push({
          idrxSpent: "0x" + args.idrxSpent.toString(16),
          cbBTCReceived: "0x" + args.cbBTCReceived.toString(16),
          blockNumber: "0x" + log.blockNumber.toString(16),
          transactionHash: log.transactionHash,
          timestamp: 0,
        });
      }

      if (results.length > 0) break;
    } catch {
      // Skip chunk on error and try next
    }
  }

  return results;
}
