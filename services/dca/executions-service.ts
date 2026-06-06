import { getBasePublicClient } from "@/lib/base-client";
import { PAYSATS_DCA_ADDRESS, paysatsDcaAbi } from "@/lib/contracts/paysats-dca";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/services/errors";
import { getPreferredEthereumAddress } from "@/services/privy/server";
import type { User } from "@privy-io/server-auth";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { base } from "viem/chains";

/** Alchemy free tier limits eth_getLogs ranges to 10 blocks. */
const NARROW_CHUNK = BigInt(9);
/** Public Base node allows ~10k-block eth_getLogs. Use only for backfill. */
const WIDE_CHUNK = BigInt(9_999);
/** Cap on backfill depth to bound latency; ~200k blocks ≈ 4-5 days on Base. */
const MAX_BACKFILL_BLOCKS = BigInt(200_000);
/** Max wide-chunk requests per backfill call. */
const MAX_BACKFILL_REQUESTS = 25;
const BLOCKS_PER_SECOND = 0.5;

export type PersistedExecution = {
  idrxSpent: string;
  cbBTCReceived: string;
  blockNumber: string;
  transactionHash: string;
  timestamp: number;
};

function getPublicBaseRpcClient() {
  return createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });
}

/**
 * Returns all known DCAExecuted swaps for the caller's smart wallet, persisting
 * newly-discovered on-chain logs. Shared by the API route and MCP tools.
 */
export async function getDcaExecutions(
  privyUser: User,
): Promise<{ executions: PersistedExecution[] }> {
  const wallet = getPreferredEthereumAddress(privyUser);
  if (!wallet || !isAddress(wallet)) {
    throw new ServiceError(400, "Wallet tidak ditemukan");
  }

  const userRow = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!userRow) {
    throw new ServiceError(404, "User not found");
  }

  const addr = getAddress(wallet) as `0x${string}`;
  const addrLower = addr.toLowerCase();

  try {
    const pc = getBasePublicClient();

    const [currentBlock, orderResult, persistedRowsBefore] = await Promise.all([
      pc.getBlockNumber(),
      pc.readContract({
        address: PAYSATS_DCA_ADDRESS,
        abi: paysatsDcaAbi,
        functionName: "orders",
        args: [addr],
      }),
      prisma.dcaExecution.findMany({ where: { walletAddress: addrLower } }),
    ]);

    const executedSwaps = Number(orderResult[3]);
    const lastExecutedAt = Number(orderResult[4]);
    const interval = Number(orderResult[1]);

    const knownHashes = new Set(
      persistedRowsBefore.map((r) => r.txHash.toLowerCase()),
    );

    const newlyFound: PersistedExecution[] = [];
    if (executedSwaps > 0 && lastExecutedAt > 0) {
      const nowTs = Math.floor(Date.now() / 1000);
      const timestamps: number[] = [];
      for (let i = 0; i < executedSwaps; i++) {
        timestamps.push(lastExecutedAt - (executedSwaps - 1 - i) * interval);
      }

      for (const ts of timestamps) {
        const blocksAgo = Math.ceil((nowTs - ts) * BLOCKS_PER_SECOND);
        const est = Number(currentBlock) - blocksAgo;
        const from = BigInt(Math.max(0, est - 100));
        const to = BigInt(est + 100);

        const found = await scanNarrow(pc, addr, from, to);
        for (const log of found) {
          if (!knownHashes.has(log.transactionHash.toLowerCase())) {
            newlyFound.push(log);
            knownHashes.add(log.transactionHash.toLowerCase());
          }
        }
      }
    }

    if (persistedRowsBefore.length === 0 && newlyFound.length === 0) {
      try {
        const wideFound = await backfillWide(addr, currentBlock);
        for (const log of wideFound) {
          if (!knownHashes.has(log.transactionHash.toLowerCase())) {
            newlyFound.push(log);
            knownHashes.add(log.transactionHash.toLowerCase());
          }
        }
      } catch (e) {
        console.warn("DCA wide backfill failed (non-fatal):", e);
      }
    }

    if (newlyFound.length > 0) {
      const uniqueBlocks = new Set(newlyFound.map((l) => l.blockNumber));
      const blockTs = new Map<string, number>();
      await Promise.all(
        Array.from(uniqueBlocks).map(async (bnHex) => {
          try {
            const b = await pc.getBlock({ blockNumber: BigInt(bnHex) });
            blockTs.set(bnHex, Number(b.timestamp));
          } catch {
            // ignore
          }
        }),
      );

      await Promise.all(
        newlyFound.map((log) =>
          prisma.dcaExecution.upsert({
            where: {
              walletAddress_txHash: {
                walletAddress: addrLower,
                txHash: log.transactionHash,
              },
            },
            create: {
              userId: userRow.id,
              walletAddress: addrLower,
              txHash: log.transactionHash,
              blockNumber: BigInt(log.blockNumber).toString(),
              idrxSpentRaw: BigInt(log.idrxSpent).toString(),
              cbBtcReceivedRaw: BigInt(log.cbBTCReceived).toString(),
              executedAt: blockTs.has(log.blockNumber)
                ? new Date(blockTs.get(log.blockNumber)! * 1000)
                : null,
            },
            update: {},
          }),
        ),
      );
    }

    const rows = await prisma.dcaExecution.findMany({
      where: { walletAddress: addrLower },
    });

    const executions = rows
      .map((r) => ({
        idrxSpent: "0x" + BigInt(r.idrxSpentRaw).toString(16),
        cbBTCReceived: "0x" + BigInt(r.cbBtcReceivedRaw).toString(16),
        blockNumber: "0x" + BigInt(r.blockNumber).toString(16),
        transactionHash: r.txHash,
        timestamp: r.executedAt ? Math.floor(r.executedAt.getTime() / 1000) : 0,
      }))
      .sort((a, b) => Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)));

    return { executions };
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    console.error("DCA executions error:", e);
    throw new ServiceError(502, "Gagal memuat riwayat swap");
  }
}

async function scanNarrow(
  pc: ReturnType<typeof getBasePublicClient>,
  user: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<PersistedExecution[]> {
  const results: PersistedExecution[] = [];
  for (
    let start = fromBlock;
    start <= toBlock;
    start += NARROW_CHUNK + BigInt(1)
  ) {
    const end = start + NARROW_CHUNK > toBlock ? toBlock : start + NARROW_CHUNK;
    try {
      const logs = await pc.getContractEvents({
        address: PAYSATS_DCA_ADDRESS,
        abi: paysatsDcaAbi,
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
    } catch {
      // skip chunk on error
    }
  }
  return results;
}

async function backfillWide(
  user: `0x${string}`,
  currentBlock: bigint,
): Promise<PersistedExecution[]> {
  const pub = getPublicBaseRpcClient();
  const earliest =
    currentBlock > MAX_BACKFILL_BLOCKS
      ? currentBlock - MAX_BACKFILL_BLOCKS
      : BigInt(0);

  const results: PersistedExecution[] = [];
  let to = currentBlock;
  let requests = 0;

  while (to >= earliest && requests < MAX_BACKFILL_REQUESTS) {
    const from = to >= WIDE_CHUNK ? to - WIDE_CHUNK : BigInt(0);
    try {
      const logs = await pub.getContractEvents({
        address: PAYSATS_DCA_ADDRESS,
        abi: paysatsDcaAbi,
        eventName: "DCAExecuted",
        args: { user },
        fromBlock: from,
        toBlock: to,
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
    } catch {
      break;
    }
    if (from === BigInt(0)) break;
    to = from - BigInt(1);
    requests += 1;
  }

  return results;
}
