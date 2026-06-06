// Creates the PaySats agent DCA policy via the Privy Node SDK and prints its id.
// Run with: node --env-file=.env scripts/create-agent-policy.mjs
import { PrivyClient } from "@privy-io/node";

const IDRX_TOKEN_ADDRESS = "0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22";
const PAYSATS_DCA_ADDRESS = "0xd89E73e565B3990d4308548e969d76c850874534";

const APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];
const CREATE_ORDER_ABI = [
  {
    name: "createOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountPerSwap", type: "uint256" },
      { name: "interval", type: "uint256" },
      { name: "totalSwaps", type: "uint256" },
      { name: "minOutputBps", type: "uint256" },
    ],
    outputs: [],
  },
];
const CANCEL_ORDER_ABI = [
  { name: "cancelOrder", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
];

const ALLOWED_CALLS = [
  { label: "IDRX approve", to: IDRX_TOKEN_ADDRESS, functionName: "approve", abi: APPROVE_ABI },
  { label: "DCA createOrder", to: PAYSATS_DCA_ADDRESS, functionName: "createOrder", abi: CREATE_ORDER_ABI },
  { label: "DCA cancelOrder", to: PAYSATS_DCA_ADDRESS, functionName: "cancelOrder", abi: CANCEL_ORDER_ABI },
];
const ALLOWED_METHODS = ["eth_sendTransaction", "wallet_sendCalls"];

function buildRules() {
  const rules = [];
  for (const method of ALLOWED_METHODS) {
    for (const call of ALLOWED_CALLS) {
      rules.push({
        name: `Allow ${call.label} (${method})`,
        method,
        action: "ALLOW",
        conditions: [
          { field_source: "ethereum_transaction", field: "to", operator: "eq", value: call.to },
          {
            field_source: "ethereum_calldata",
            field: "function_name",
            abi: call.abi,
            operator: "eq",
            value: call.functionName,
          },
        ],
      });
    }
  }
  return rules;
}

async function main() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }
  const ownerId = process.env.PRIVY_AGENT_SIGNER_ID?.trim() || undefined;

  const privy = new PrivyClient({ appId, appSecret });

  const base = {
    version: "1.0",
    name: "PaySats agent DCA",
    chain_type: "ethereum",
    rules: buildRules(),
  };

  let policy;
  try {
    policy = await privy.policies().create(ownerId ? { ...base, owner_id: ownerId } : base);
  } catch (e) {
    console.warn("Create with owner_id failed, retrying without owner:", e?.message || e);
    policy = await privy.policies().create(base);
  }

  console.log("\nPolicy created:");
  console.log("  id:", policy.id);
  console.log("\nAdd these to .env:");
  console.log(`  PRIVY_AGENT_POLICY_ID="${policy.id}"`);
  console.log(`  NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID="${policy.id}"`);
}

main().catch((e) => {
  console.error("Failed to create policy:", e?.response?.data ?? e?.message ?? e);
  process.exit(1);
});
