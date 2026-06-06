import { CBBTC_DECIMALS } from "@/lib/contracts/paysats-dca";
import { errorMessage } from "@/services/errors";
import { getDcaExecutions } from "@/services/dca/executions-service";
import {
  getAccountBalances,
  getDcaOrder,
} from "@/services/dca/order-service";
import { cancelDca, setupDca } from "@/services/dca/signing-service";
import { createIdrMintRequest } from "@/services/idrx/mint-service";
import { getMintStatus } from "@/services/idrx/transactions-service";
import { getIdrxOnboardingStatus } from "@/services/idrx/onboarding-service";
import { verifyAccessToken } from "@/services/oauth/store";
import { getPrivyUserById } from "@/services/privy/server";
import type { User } from "@privy-io/server-auth";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

function privyUserIdFrom(authInfo: AuthInfo | undefined): string | null {
  const id = authInfo?.extra?.privyUserId;
  return typeof id === "string" ? id : null;
}

/** Resolve the authenticated Privy user from the MCP request's auth info. */
async function resolveUser(authInfo: AuthInfo | undefined): Promise<User> {
  const privyUserId = privyUserIdFrom(authInfo);
  if (!privyUserId) throw new Error("Tidak terautentikasi");
  const user = await getPrivyUserById(privyUserId);
  if (!user) throw new Error("User tidak ditemukan");
  return user;
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_account",
      {
        title: "Get account",
        description:
          "Get the user's wallet address, IDRX and cbBTC balances, IDRX onboarding status, active DCA order, and whether the agent (session signer) is connected.",
        inputSchema: {},
      },
      async (_args, extra) => {
        try {
          const user = await resolveUser(extra.authInfo);
          const [balances, order, onboarding] = await Promise.all([
            getAccountBalances(user),
            getDcaOrder(user),
            getIdrxOnboardingStatus(user),
          ]);
          return text(
            JSON.stringify(
              {
                walletAddress: balances.walletAddress,
                balances: {
                  idrx: balances.idrxAmount,
                  cbBtcSats: balances.cbBtcSats,
                },
                idrxOnboarded: onboarding.completed,
                dcaOrder: order,
              },
              null,
              2,
            ),
          );
        } catch (e) {
          return text(errorMessage(e, "Gagal memuat akun"));
        }
      },
    );

    server.registerTool(
      "create_idr_deposit",
      {
        title: "Create IDR deposit",
        description:
          "Create an IDR deposit (IDRX mint) request for the given rupiah amount. Returns a payment URL the human must open and pay (bank/QRIS). IDRX is minted to the user's smart wallet once paid. The agent cannot pay on the user's behalf.",
        inputSchema: {
          amountIdr: z
            .number()
            .int()
            .min(20_000)
            .max(1_000_000_000)
            .describe("Amount in Indonesian Rupiah (IDR), 20000 – 1000000000."),
        },
      },
      async ({ amountIdr }, extra) => {
        try {
          const user = await resolveUser(extra.authInfo);
          const res = await createIdrMintRequest(user, { toBeMinted: amountIdr });
          return text(
            JSON.stringify(
              {
                paymentUrl: res.paymentUrl,
                amount: res.amount,
                reference: res.reference,
                merchantOrderId: res.merchantOrderId,
                destinationWalletAddress: res.destinationWalletAddress,
                instructions:
                  "Open paymentUrl in a browser and complete the rupiah payment. Then call get_deposit_status with the reference to track settlement.",
              },
              null,
              2,
            ),
          );
        } catch (e) {
          return text(errorMessage(e, "Gagal membuat deposit"));
        }
      },
    );

    server.registerTool(
      "get_deposit_status",
      {
        title: "Get deposit status",
        description:
          "Check the payment and mint settlement status of an IDR deposit by its reference or merchantOrderId.",
        inputSchema: {
          reference: z.string().optional().describe("Mint request reference."),
          merchantOrderId: z
            .string()
            .optional()
            .describe("Mint request merchantOrderId."),
        },
      },
      async ({ reference, merchantOrderId }, extra) => {
        try {
          const user = await resolveUser(extra.authInfo);
          const tx = await getMintStatus(user, { reference, merchantOrderId });
          if (!tx) return text("Deposit tidak ditemukan.");
          return text(
            JSON.stringify(
              {
                reference: tx.reference,
                merchantOrderId: tx.merchantOrderId,
                paymentAmount: tx.paymentAmount,
                toBeMinted: tx.toBeMinted,
                paymentStatus: tx.paymentStatus,
                userMintStatus: tx.userMintStatus,
                settlement: tx.settlement,
                txHash: tx.txHash,
              },
              null,
              2,
            ),
          );
        } catch (e) {
          return text(errorMessage(e, "Gagal memuat status deposit"));
        }
      },
    );

    server.registerTool(
      "setup_dca",
      {
        title: "Set up recurring DCA",
        description:
          "Create a recurring DCA order that swaps IDRX into cbBTC on the chosen schedule. Requires the user to have an IDRX balance (deposit first) and to have connected the agent. Signed by the session signer, no browser needed.",
        inputSchema: {
          amountIdr: z
            .number()
            .int()
            .positive()
            .describe("IDR amount to swap each interval."),
          frequency: z
            .enum(["daily", "weekly", "monthly"])
            .describe("How often to swap."),
          totalSwaps: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Number of swaps; 0 or omitted = unlimited."),
        },
      },
      async ({ amountIdr, frequency, totalSwaps }, extra) => {
        try {
          const user = await resolveUser(extra.authInfo);
          const res = await setupDca(user, {
            amountPerSwapIdr: amountIdr,
            frequency,
            totalSwaps,
          });
          return text(
            JSON.stringify(
              {
                ok: true,
                transactionId: res.transactionId,
                amountPerSwapIdr: amountIdr,
                frequency,
                totalSwaps: totalSwaps ?? 0,
              },
              null,
              2,
            ),
          );
        } catch (e) {
          return text(errorMessage(e, "Gagal membuat DCA"));
        }
      },
    );

    server.registerTool(
      "get_dca_status",
      {
        title: "Get DCA status",
        description: "Get the user's active recurring DCA order, if any.",
        inputSchema: {},
      },
      async (_args, extra) => {
        try {
          const user = await resolveUser(extra.authInfo);
          const order = await getDcaOrder(user);
          if (!order) return text("Tidak ada order DCA aktif.");
          return text(JSON.stringify(order, null, 2));
        } catch (e) {
          return text(errorMessage(e, "Gagal memuat status DCA"));
        }
      },
    );

    server.registerTool(
      "cancel_dca",
      {
        title: "Cancel DCA",
        description: "Cancel the user's active recurring DCA order.",
        inputSchema: {},
      },
      async (_args, extra) => {
        try {
          const user = await resolveUser(extra.authInfo);
          const res = await cancelDca(user);
          return text(
            JSON.stringify({ ok: true, transactionId: res.transactionId }, null, 2),
          );
        } catch (e) {
          return text(errorMessage(e, "Gagal membatalkan DCA"));
        }
      },
    );

    server.registerTool(
      "get_dca_history",
      {
        title: "Get DCA history",
        description:
          "List executed DCA swaps (IDRX spent and cbBTC/sats received) for the user.",
        inputSchema: {},
      },
      async (_args, extra) => {
        try {
          const user = await resolveUser(extra.authInfo);
          const { executions } = await getDcaExecutions(user);
          const items = executions.map((e) => ({
            txHash: e.transactionHash,
            idrxSpent: Number(BigInt(e.idrxSpent)) / 100,
            satsReceived: Number(BigInt(e.cbBTCReceived)) / 10 ** (CBBTC_DECIMALS - 8),
            timestamp: e.timestamp,
          }));
          return text(JSON.stringify({ count: items.length, executions: items }, null, 2));
        } catch (e) {
          return text(errorMessage(e, "Gagal memuat riwayat DCA"));
        }
      },
    );
  },
  { serverInfo: { name: "paysats-dca", version: "0.1.0" } },
  { basePath: "/api/mcp", disableSse: true, verboseLogs: false },
);

/** Resolve our opaque OAuth access token to MCP AuthInfo (carrying privyUserId). */
const authHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    const row = await verifyAccessToken(bearerToken);
    if (!row) return undefined;
    const info: AuthInfo = {
      token: bearerToken,
      clientId: row.clientId,
      scopes: row.scope ? row.scope.split(" ") : [],
      expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
      extra: { privyUserId: row.privyUserId },
    };
    return info;
  },
  { required: true },
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
