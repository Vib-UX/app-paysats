/**
 * DCA service — on-chain order management via PaySatsDCA contract.
 *
 * Order creation and cancellation happen client-side through Privy embedded
 * smart wallets (ERC-4337). Chainlink Automation handles execution.
 *
 * This module re-exports contract types for server-side code that needs them.
 */
export type { DcaOrder } from "@/lib/contracts/paysats-dca";
export {
  PAYSATS_DCA_ADDRESS,
  IDRX_TOKEN_ADDRESS,
  paysatsDcaAbi,
  IDRX_DECIMALS,
  INTERVAL_PRESETS,
} from "@/lib/contracts/paysats-dca";
