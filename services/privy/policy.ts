import {
  IDRX_TOKEN_ADDRESS,
  PAYSATS_DCA_ADDRESS,
} from "@/lib/contracts/paysats-dca";

/**
 * Minimal ABIs Privy needs to decode calldata for the policy `function_name`
 * conditions. Only the functions the agent is allowed to call.
 */
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
  {
    name: "cancelOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
];

type AllowedCall = {
  label: string;
  to: string;
  functionName: string;
  abi: unknown[];
};

const ALLOWED_CALLS: AllowedCall[] = [
  {
    label: "IDRX approve",
    to: IDRX_TOKEN_ADDRESS,
    functionName: "approve",
    abi: APPROVE_ABI,
  },
  {
    label: "DCA createOrder",
    to: PAYSATS_DCA_ADDRESS,
    functionName: "createOrder",
    abi: CREATE_ORDER_ABI,
  },
  {
    label: "DCA cancelOrder",
    to: PAYSATS_DCA_ADDRESS,
    functionName: "cancelOrder",
    abi: CANCEL_ORDER_ABI,
  },
];

/**
 * The methods the agent session signer can invoke. We call `sendCalls`
 * (wallet_sendCalls) for the batched approve+createOrder; eth_sendTransaction is
 * included so single-tx fallbacks are also covered. Anything else is denied by
 * default (policies are default-deny once rules exist).
 */
const ALLOWED_METHODS = ["eth_sendTransaction", "wallet_sendCalls"] as const;

function buildRules() {
  const rules = [];
  for (const method of ALLOWED_METHODS) {
    for (const call of ALLOWED_CALLS) {
      rules.push({
        name: `Allow ${call.label} (${method})`,
        method,
        action: "ALLOW" as const,
        conditions: [
          {
            field_source: "ethereum_transaction",
            field: "to",
            operator: "eq",
            value: call.to,
          },
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

/**
 * Privy policy scoping the agent session signer to exactly the DCA flow:
 *   - approve(IDRX) (so the DCA contract can pull IDRX)
 *   - createOrder / cancelOrder on PaySatsDCA
 * Everything else is denied, so a compromised server key cannot move funds.
 *
 * Create once via scripts/create-agent-policy.mjs, then set the returned id as
 * PRIVY_AGENT_POLICY_ID + NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID.
 */
export function buildAgentDcaPolicy(ownerId?: string) {
  return {
    version: "1.0" as const,
    name: "PaySats agent DCA",
    chain_type: "ethereum" as const,
    rules: buildRules(),
    ...(ownerId ? { owner_id: ownerId } : {}),
  };
}

/** Dashboard-configured signer id the user grants via addSigners during /connect. */
export function getAgentSignerId(): string | undefined {
  return (
    process.env.PRIVY_AGENT_SIGNER_ID?.trim() ||
    process.env.NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID?.trim() ||
    undefined
  );
}

/** Policy id attached to the granted signer. */
export function getAgentPolicyId(): string | undefined {
  return (
    process.env.PRIVY_AGENT_POLICY_ID?.trim() ||
    process.env.NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID?.trim() ||
    undefined
  );
}
