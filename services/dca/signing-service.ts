import { getBasePublicClient } from "@/lib/base-client";
import {
  erc20Abi,
  IDRX_DECIMALS,
  IDRX_TOKEN_ADDRESS,
  PAYSATS_DCA_ADDRESS,
  paysatsDcaAbi,
} from "@/lib/contracts/paysats-dca";
import { ServiceError } from "@/services/errors";
import {
  resolveIntervalSeconds,
  requireWalletAddress,
} from "@/services/dca/order-service";
import {
  refreshDeviceContext,
  requireDeviceContext,
} from "@/services/privy/device-session";
import { getPrivyNodeClient } from "@/services/privy/node";
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

export type SetupDcaResult =
  | {
      status: "created";
      transactionId: string;
      amountPerSwapRaw: string;
      intervalSeconds: number;
    }
  | {
      status: "needs_deposit";
      /** Whole-IDR shortfall the user must deposit to fund the order. */
      shortfallIdr: number;
      requiredIdr: number;
      balanceIdr: number;
      amountPerSwapRaw: string;
      intervalSeconds: number;
    };

type Call = { to: `0x${string}`; data: `0x${string}`; value: string };

/**
 * Send a batched call from the user's wallet, authorized by the user's
 * device-authorization grant access token (used as a `user_jwt`). The Privy SDK
 * transparently exchanges the JWT for a short-lived user signing key (HPKE) and
 * signs the request — so we never handle the static authorization key here.
 *
 * If the access token is rejected (e.g. expired between our refresh check and
 * the call), we refresh once via the stored refresh token and retry.
 *
 * NOTE (verify live): `walletId` is the embedded wallet id captured at approval
 * and IDRX/orders live on the smart wallet returned by getPreferredEthereumAddress.
 * Confirm during e2e whether device-grant RPC must target the smart wallet id
 * for sponsored ERC-4337 execution, and adjust the stored walletId if needed.
 */
async function sendCallsWithDeviceAuth(
  privyUserId: string,
  calls: Call[],
): Promise<string> {
  const privy = getPrivyNodeClient();
  let ctx = await requireDeviceContext(privyUserId);

  const run = (accessToken: string, walletId: string) =>
    privy
      .wallets()
      .ethereum()
      .sendCalls(walletId, {
        caip2: BASE_CAIP2,
        sponsor: true,
        params: { calls },
        authorization_context: {
          user_jwts: [accessToken],
        },
      });

  try {
    const res = await run(ctx.accessToken, ctx.walletId);
    return res.transaction_id;
  } catch (e) {
    // Token may have been rejected — refresh once and retry.
    try {
      ctx = await refreshDeviceContext(privyUserId);
    } catch {
      throw e instanceof Error ? e : new Error(String(e));
    }
    const res = await run(ctx.accessToken, ctx.walletId);
    return res.transaction_id;
  }
}

/**
 * Execute approve(IDRX) + createOrder on PaySatsDCA as a single batched call
 * from the user's wallet, authorized by the user's device-grant access token.
 * Requires the user to have approved agent access (device authorization grant).
 */
export async function setupDca(
  privyUser: User,
  params: SetupDcaParams,
): Promise<SetupDcaResult> {
  const smartAddr = requireWalletAddress(privyUser);

  if (
    !Number.isFinite(params.amountPerSwapIdr) ||
    params.amountPerSwapIdr <= 0
  ) {
    throw new ServiceError(400, "Invalid per-swap amount.");
  }
  const amountPerSwap =
    BigInt(Math.floor(params.amountPerSwapIdr)) *
    BigInt(10) ** BigInt(IDRX_DECIMALS);
  const intervalSeconds = resolveIntervalSeconds(params.frequency);
  const totalSwaps = BigInt(Math.max(0, Math.floor(params.totalSwaps ?? 0)));
  const minOutputBps = BigInt(
    Math.max(0, Math.floor(params.minOutputBps ?? 0)),
  );

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
    // Not enough IDRX yet — signal the caller to create a deposit for the
    // shortfall so the agent can hand the user a payment link and finalize the
    // DCA once funds arrive.
    const shortfallIdr = Math.ceil(
      Number(requiredIdrx - balance) / 10 ** IDRX_DECIMALS,
    );
    return {
      status: "needs_deposit",
      shortfallIdr,
      requiredIdr: Number(requiredIdrx) / 10 ** IDRX_DECIMALS,
      balanceIdr: Number(balance) / 10 ** IDRX_DECIMALS,
      amountPerSwapRaw: amountPerSwap.toString(),
      intervalSeconds,
    };
  }

  const approvalAmount =
    totalSwaps > BigInt(0) ? amountPerSwap * totalSwaps : MAX_UINT256;
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

  const transactionId = await sendCallsWithDeviceAuth(privyUser.id, [
    { to: IDRX_TOKEN_ADDRESS, data: approveData, value: "0x0" },
    { to: PAYSATS_DCA_ADDRESS, data: createOrderData, value: "0x0" },
  ]);

  return {
    status: "created",
    transactionId,
    amountPerSwapRaw: amountPerSwap.toString(),
    intervalSeconds,
  };
}

/** Cancel the user's active DCA order, authorized by the device-grant token. */
export async function cancelDca(
  privyUser: User,
): Promise<{ transactionId: string }> {
  const cancelData = encodeFunctionData({
    abi: paysatsDcaAbi,
    functionName: "cancelOrder",
  });

  const transactionId = await sendCallsWithDeviceAuth(privyUser.id, [
    { to: PAYSATS_DCA_ADDRESS, data: cancelData, value: "0x0" },
  ]);

  return { transactionId };
}
