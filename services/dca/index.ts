/**
 * DCA service — on-chain order management via ArkaDCA contract.
 *
 * Order creation and cancellation happen client-side through Privy embedded
 * smart wallets (ERC-4337). Chainlink Automation handles execution.
 *
 * This module re-exports contract types for server-side code that needs them.
 */
export type { DcaOrder } from "@/lib/contracts/arka-dca";
export {
  ARKA_DCA_ADDRESS,
  IDRX_TOKEN_ADDRESS,
  arkaDcaAbi,
  IDRX_DECIMALS,
  INTERVAL_PRESETS,
} from "@/lib/contracts/arka-dca";
