import { getAddress, parseAbi } from "viem";

export const PAYSATS_DCA_ADDRESS = getAddress(
  "0xd89E73e565B3990d4308548e969d76c850874534",
);

export const IDRX_TOKEN_ADDRESS = getAddress(
  "0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22",
);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const paysatsDcaAbi = parseAbi([
  "function createOrder(uint256 amountPerSwap, uint256 interval, uint256 totalSwaps, uint256 minOutputBps)",
  "function cancelOrder()",
  "function orders(address user) view returns (uint256 amountPerSwap, uint256 interval, uint256 totalSwaps, uint256 executedSwaps, uint256 lastExecutedAt, uint256 minOutputBps, bool active)",
  "event DCAExecuted(address indexed user, uint256 idrxSpent, uint256 cbBTCReceived)",
]);

export type DcaOrder = {
  amountPerSwap: bigint;
  interval: bigint;
  totalSwaps: bigint;
  executedSwaps: bigint;
  lastExecutedAt: bigint;
  minOutputBps: bigint;
  active: boolean;
};

export const INTERVAL_PRESETS = [
  { label: "Harian", seconds: 86_400 },
  { label: "Mingguan", seconds: 604_800 },
  { label: "Bulanan", seconds: 2_592_000 },
] as const;

/** IDRX has 2 decimals — Rp 1,000 = 100_000 smallest unit */
export const IDRX_DECIMALS = 2;

/** cbBTC has 8 decimals — same as native BTC (1 sat = 1e-8 BTC) */
export const CBBTC_DECIMALS = 8;

export type DcaExecution = {
  idrxSpent: bigint;
  cbBTCReceived: bigint;
  blockNumber: bigint;
  transactionHash: string;
};
