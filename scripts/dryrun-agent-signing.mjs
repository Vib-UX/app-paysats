// Dry-run the agent session-signer path directly against the Privy SDK, without
// going through Claude/MCP. Validates that:
//   - sendCalls works with the session-signer authorization context
//   - the DCA policy ALLOWS approve / createOrder / cancelOrder
//   - the DCA policy DENIES anything else (e.g. an IDRX transfer)
//
// Prereqs: the wallet must already have the agent signer added (user completed
// /connect). Pass the wallet's Privy server id.
//
// Usage:
//   node --env-file=.env scripts/dryrun-agent-signing.mjs --wallet=<walletId> --action=cancel
//   node --env-file=.env scripts/dryrun-agent-signing.mjs --wallet=<walletId> --action=setup --amount=20000 --frequency=daily
//   node --env-file=.env scripts/dryrun-agent-signing.mjs --wallet=<walletId> --action=deny   # expect a policy violation
import { PrivyClient } from "@privy-io/node";
import { encodeFunctionData, parseAbi } from "viem";

const IDRX_TOKEN_ADDRESS = "0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22";
const PAYSATS_DCA_ADDRESS = "0xd89E73e565B3990d4308548e969d76c850874534";
const BASE_CAIP2 = "eip155:8453";
const IDRX_DECIMALS = 2;
const MAX_UINT256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);
const dcaAbi = parseAbi([
  "function createOrder(uint256 amountPerSwap, uint256 interval, uint256 totalSwaps, uint256 minOutputBps)",
  "function cancelOrder()",
]);

const INTERVALS = { daily: 86_400, weekly: 604_800, monthly: 2_592_000 };

function arg(name, def) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : def;
}

function buildCalls(action) {
  if (action === "cancel") {
    return [
      {
        to: PAYSATS_DCA_ADDRESS,
        data: encodeFunctionData({ abi: dcaAbi, functionName: "cancelOrder" }),
        value: "0x0",
      },
    ];
  }
  if (action === "setup") {
    const amountIdr = Number(arg("amount", "20000"));
    const frequency = arg("frequency", "daily");
    const interval = INTERVALS[frequency];
    if (!interval) throw new Error(`frequency must be one of ${Object.keys(INTERVALS).join(", ")}`);
    const amountPerSwap = BigInt(Math.floor(amountIdr)) * BigInt(10) ** BigInt(IDRX_DECIMALS);
    const approve = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [PAYSATS_DCA_ADDRESS, BigInt(MAX_UINT256)],
    });
    const createOrder = encodeFunctionData({
      abi: dcaAbi,
      functionName: "createOrder",
      args: [amountPerSwap, BigInt(interval), BigInt(0), BigInt(0)],
    });
    return [
      { to: IDRX_TOKEN_ADDRESS, data: approve, value: "0x0" },
      { to: PAYSATS_DCA_ADDRESS, data: createOrder, value: "0x0" },
    ];
  }
  if (action === "deny") {
    // A disallowed call: IDRX transfer to a random address. Expect policy DENY.
    const transfer = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: ["0x000000000000000000000000000000000000dEaD", BigInt(1)],
    });
    return [{ to: IDRX_TOKEN_ADDRESS, data: transfer, value: "0x0" }];
  }
  throw new Error(`Unknown action '${action}'. Use setup | cancel | deny.`);
}

async function main() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const authKey = process.env.PRIVY_AUTHORIZATION_KEY;
  const walletId = arg("wallet", process.env.DRYRUN_WALLET_ID);
  const action = arg("action", "cancel");

  if (!appId || !appSecret) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  if (!authKey) throw new Error("PRIVY_AUTHORIZATION_KEY must be set");
  if (!walletId) throw new Error("Pass --wallet=<privyWalletId> (or set DRYRUN_WALLET_ID)");

  const calls = buildCalls(action);
  console.log(`Action: ${action}`);
  console.log(`Wallet: ${walletId}`);
  console.log(`Calls:`, JSON.stringify(calls, null, 2));

  const privy = new PrivyClient({ appId, appSecret });

  try {
    const res = await privy.wallets().ethereum().sendCalls(walletId, {
      caip2: BASE_CAIP2,
      sponsor: true,
      params: { calls },
      authorization_context: { authorization_private_keys: [authKey] },
    });
    console.log("\nResult (submitted):", JSON.stringify(res, null, 2));
    if (action === "deny") {
      console.log("\n[WARN] The 'deny' probe was NOT blocked — the policy may be too permissive.");
    }
  } catch (e) {
    const detail = e?.response?.data ?? e?.body ?? e?.message ?? e;
    const text = typeof detail === "string" ? detail : JSON.stringify(detail);
    console.log("\nError:", JSON.stringify(detail, null, 2));
    if (action === "deny") {
      if (/policy_violation|policy/i.test(text)) {
        console.log("\n[OK] Disallowed call rejected by policy (expected for the 'deny' probe).");
      } else {
        console.log(
          "\n[INCONCLUSIVE] Call failed, but not with a policy violation (e.g. bad wallet id). Re-run with a real delegated wallet id to verify the policy.",
        );
      }
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e?.message ?? e);
  process.exit(1);
});
