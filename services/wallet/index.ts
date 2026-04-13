/**
 * Wallet resolution for IDRX mint destination and future DCA flows.
 * Today: embedded EVM address comes from Privy (see services/privy/server.ts).
 */
export type ResolvedWallet = {
  chainType: "ethereum";
  address: string;
};

export function assertEvmAddress(addr: string): asserts addr is string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error("Invalid EVM address");
  }
}
