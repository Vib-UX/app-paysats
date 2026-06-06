import { getBasePublicClient } from "@/lib/base-client";
import {
  erc20Abi,
  IDRX_DECIMALS,
  IDRX_TOKEN_ADDRESS,
  PAYSATS_DCA_ADDRESS,
  paysatsDcaAbi,
} from "@/lib/contracts/paysats-dca";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/services/errors";
import { resolveIntervalSeconds, requireWalletAddress } from "@/services/dca/order-service";
import { getAgentAuthorizationKey, getPrivyNodeClient } from "@/services/privy/node";
import type { User } from "@privy-io/server-auth";
import { encodeFunctionData } from "viem";

const BASE_CAIP2 = "eip155:8453";
const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);

export type DcaFrequency = "daily" | "weekly" | "monthly";

export type SetupDcaParams = {
  /** IDR amount to swap each interval. */
  amountPerSwapIdr: number;
  frequency: DcaFrequency;
  /** 0 = unlimited (default). */
  totalSwaps?: number;
  minOutputBps?: number;
};

type AgentContext = {
  walletId: string;
  authorizationKey: string;
};

/**
 * Resolve the agent signing context for a user, or throw a clear error telling
 * the caller what is missing (server config vs. user not yet connected).
 */
async function requireAgentContext(privyUser: User): Promise<AgentContext> {
  const authorizationKey = getAgentAuthorizationKey();
  if (!authorizationKey) {
    throw new ServiceError(
      503,
      "Agent signing belum dikonfigurasi di server (PRIVY_AUTHORIZATION_KEY).",
    );
  }
  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!row?.agentLinkedAt || !row.agentWalletId || !row.agentSignerId) {
    throw new ServiceError(
      403,
      "Hubungkan agent terlebih dahulu (buka tautan connect untuk memberi izin session signer).",
    );
  }
  return { walletId: row.agentWalletId, authorizationKey };
}

/**
 * Execute approve(IDRX) + createOrder on PaySatsDCA as a single batched call
 * from the user's smart wallet, signed by our session signer. Requires the user
 * to have connected the agent and the server to hold the authorization key.
 *
 * NOTE: relies on Privy smart wallets + session signers being enabled in the
 * Privy Dashboard. The policy attached to the signer must permit exactly these
 * two calls (see services/privy/policy.ts for the policy template).
 */
export async function setupDca(
  privyUser: User,
  params: SetupDcaParams,
): Promise<{ transactionId: string; amountPerSwapRaw: string; intervalSeconds: number }> {
  const { walletId, authorizationKey } = await requireAgentContext(privyUser);
  const smartAddr = requireWalletAddress(privyUser);

  if (!Number.isFinite(params.amountPerSwapIdr) || params.amountPerSwapIdr <= 0) {
    throw new ServiceError(400, "Nominal per swap tidak valid");
  }
  const amountPerSwap =
    BigInt(Math.floor(params.amountPerSwapIdr)) * BigInt(10) ** BigInt(IDRX_DECIMALS);
  const intervalSeconds = resolveIntervalSeconds(params.frequency);
  const totalSwaps = BigInt(Math.max(0, Math.floor(params.totalSwaps ?? 0)));
  const minOutputBps = BigInt(Math.max(0, Math.floor(params.minOutputBps ?? 0)));

  // Funding check against the smart wallet (IDRX is minted there).
  const requiredIdrx =
    totalSwaps > BigInt(0) ? amountPerSwap * totalSwaps : amountPerSwap;
  const pc = getBasePublicClient();
  const balance = await pc.readContract({
    address: IDRX_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [smartAddr],
  });
  if (balance < requiredIdrx) {
    const needed = Number(requiredIdrx - balance) / 10 ** IDRX_DECIMALS;
    throw new ServiceError(
      400,
      `Saldo IDRX tidak cukup. Butuh ${needed.toLocaleString("id-ID")} IDRX lagi. Deposit IDR dahulu.`,
    );
  }

  const approvalAmount = totalSwaps > BigInt(0) ? amountPerSwap * totalSwaps : MAX_UINT256;
  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [PAYSATS_DCA_ADDRESS, approvalAmount],
  });
  const createOrderData = encodeFunctionData({
    abi: paysatsDcaAbi,
    functionName: "createOrder",
    args: [amountPerSwap, BigInt(intervalSeconds), totalSwaps, minOutputBps],
  });

  const privy = getPrivyNodeClient();
  const res = await privy.wallets().ethereum().sendCalls(walletId, {
    caip2: BASE_CAIP2,
    sponsor: true,
    params: {
      calls: [
        { to: IDRX_TOKEN_ADDRESS, data: approveData, value: "0x0" },
        { to: PAYSATS_DCA_ADDRESS, data: createOrderData, value: "0x0" },
      ],
    },
    authorization_context: {
      authorization_private_keys: [authorizationKey],
    },
  });

  return {
    transactionId: res.transaction_id,
    amountPerSwapRaw: amountPerSwap.toString(),
    intervalSeconds,
  };
}

/** Cancel the user's active DCA order, signed by the session signer. */
export async function cancelDca(
  privyUser: User,
): Promise<{ transactionId: string }> {
  const { walletId, authorizationKey } = await requireAgentContext(privyUser);

  const cancelData = encodeFunctionData({
    abi: paysatsDcaAbi,
    functionName: "cancelOrder",
  });

  const privy = getPrivyNodeClient();
  const res = await privy.wallets().ethereum().sendCalls(walletId, {
    caip2: BASE_CAIP2,
    sponsor: true,
    params: {
      calls: [{ to: PAYSATS_DCA_ADDRESS, data: cancelData, value: "0x0" }],
    },
    authorization_context: {
      authorization_private_keys: [authorizationKey],
    },
  });

  return { transactionId: res.transaction_id };
}
