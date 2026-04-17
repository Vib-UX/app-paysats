import { getAddress, parseAbi } from "viem";

// ---------------------------------------------------------------------------
// Morpho Blue core (Base mainnet)
// ---------------------------------------------------------------------------

export const MORPHO_BLUE_ADDRESS = getAddress(
  "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
);

export const USDC_ADDRESS = getAddress(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
);

export const CBBTC_ADDRESS = getAddress(
  "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
);

export const USDC_DECIMALS = 6;
export const CBBTC_DECIMALS = 8;

// ---------------------------------------------------------------------------
// cbBTC / USDC market on Base (largest, ~$1.2 B supply)
// ---------------------------------------------------------------------------

export const CBBTC_USDC_MARKET_PARAMS = {
  loanToken: USDC_ADDRESS,
  collateralToken: CBBTC_ADDRESS,
  oracle: getAddress("0x663BECd10daE6C4A3Dcd89F1d76c1174199639B9"),
  irm: getAddress("0x46415998764C29aB2a25CbeA6254146D50D22687"),
  lltv: BigInt("860000000000000000"), // 86 %
} as const;

export const CBBTC_USDC_MARKET_ID =
  "0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836" as `0x${string}`;

// ---------------------------------------------------------------------------
// Math constants
// ---------------------------------------------------------------------------

export const WAD = BigInt("1000000000000000000");
export const ORACLE_PRICE_SCALE = BigInt("1000000000000000000000000000000000000");

// ---------------------------------------------------------------------------
// Safety thresholds (fraction of LLTV)
// ---------------------------------------------------------------------------

/** Green zone ceiling — up to 51.6 % actual LTV */
export const SAFE_LTV_RATIO = 0.6;
/** Yellow zone ceiling — up to 68.8 % actual LTV */
export const WARNING_LTV_RATIO = 0.8;
/** Red zone — above 77.4 % actual LTV */
export const CRITICAL_LTV_RATIO = 0.9;
/** Hard cap when opening a position — 64.5 % actual LTV */
export const MAX_BORROW_LTV_RATIO = 0.75;

// ---------------------------------------------------------------------------
// ABI fragments (Morpho Blue IMorpho interface)
// ---------------------------------------------------------------------------

export const morphoBlueAbi = parseAbi([
  // --- writes ---
  "function supplyCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)",
  "function borrow((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256, uint256)",
  "function repay((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256, uint256)",
  "function withdrawCollateral((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, address receiver)",

  // --- reads ---
  "function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
  "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
  "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
]);

/** Chainlink-style oracle used by Morpho — returns collateral price in loan-token units. */
export const morphoOracleAbi = parseAbi([
  "function price() view returns (uint256)",
]);

/** Morpho AdaptiveCurveIrm — returns per-second borrow rate (WAD-scaled). */
export const morphoIrmAbi = parseAbi([
  "function borrowRateView((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee) market) view returns (uint256)",
]);

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

export type CreditPosition = {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
};

export type MarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

export type SafetyZone = "safe" | "warning" | "danger";

export type CreditHealth = {
  healthFactor: number;
  ltvPercent: number;
  zone: SafetyZone;
  /** 0–100 score (100 = fully safe, 0 = at liquidation threshold) */
  safetyScore: number;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Convert borrow shares → actual USDC owed (ceiling division, matches Morpho's mulDivUp). */
export function borrowSharesToAssets(
  borrowShares: bigint,
  totalBorrowAssets: bigint,
  totalBorrowShares: bigint,
): bigint {
  if (totalBorrowShares === BigInt(0)) return BigInt(0);
  return (
    (borrowShares * totalBorrowAssets + totalBorrowShares - BigInt(1)) /
    totalBorrowShares
  );
}

/**
 * Simulate interest accrual since `lastUpdate` to get the real-time
 * totalBorrowAssets. `borrowRatePerSecond` comes from the IRM contract.
 */
export function accrueInterestView(
  totalBorrowAssets: bigint,
  lastUpdate: bigint,
  borrowRatePerSecond: bigint,
  nowSeconds?: bigint,
): bigint {
  const now = nowSeconds ?? BigInt(Math.floor(Date.now() / 1000));
  const elapsed = now - lastUpdate;
  if (elapsed <= BigInt(0)) return totalBorrowAssets;
  const interest =
    (totalBorrowAssets * borrowRatePerSecond * elapsed) / WAD;
  return totalBorrowAssets + interest;
}

/** Collateral value denominated in the loan token (USDC). */
export function collateralValueInLoan(
  collateralAmount: bigint,
  oraclePrice: bigint,
): bigint {
  return (collateralAmount * oraclePrice) / ORACLE_PRICE_SCALE;
}

/** Health factor as a JS number (> 1 = healthy, ≤ 1 = liquidatable). */
export function computeHealthFactor(
  collateralAmount: bigint,
  oraclePrice: bigint,
  borrowedAssets: bigint,
  lltv: bigint,
): number {
  if (borrowedAssets === BigInt(0)) return Infinity;
  const colValue = collateralValueInLoan(collateralAmount, oraclePrice);
  const hf = (colValue * lltv) / borrowedAssets;
  return Number(hf) / Number(WAD);
}

/** LTV as a percentage (0-100). */
export function computeLtvPercent(
  collateralAmount: bigint,
  oraclePrice: bigint,
  borrowedAssets: bigint,
): number {
  const colValue = collateralValueInLoan(collateralAmount, oraclePrice);
  if (colValue === BigInt(0)) return 0;
  const ltv = (borrowedAssets * WAD) / colValue;
  return (Number(ltv) / Number(WAD)) * 100;
}

/** Derive a CreditHealth object from raw on-chain values. */
export function deriveCreditHealth(
  collateralAmount: bigint,
  oraclePrice: bigint,
  borrowedAssets: bigint,
  lltv: bigint = CBBTC_USDC_MARKET_PARAMS.lltv,
): CreditHealth {
  const healthFactor = computeHealthFactor(
    collateralAmount,
    oraclePrice,
    borrowedAssets,
    lltv,
  );
  const ltvPercent = computeLtvPercent(
    collateralAmount,
    oraclePrice,
    borrowedAssets,
  );

  const lltvPercent = (Number(lltv) / Number(WAD)) * 100;
  const ltvRatio = lltvPercent > 0 ? ltvPercent / lltvPercent : 0;

  let zone: SafetyZone;
  if (ltvRatio <= SAFE_LTV_RATIO) zone = "safe";
  else if (ltvRatio <= WARNING_LTV_RATIO) zone = "warning";
  else zone = "danger";

  const safetyScore = Math.max(
    0,
    Math.min(100, Math.round((1 - ltvRatio) * 100)),
  );

  return { healthFactor, ltvPercent, zone, safetyScore };
}

/** Max USDC borrowable at the hard-cap LTV ratio given collateral + oracle price. */
export function maxSafeBorrow(
  collateralAmount: bigint,
  oraclePrice: bigint,
  lltv: bigint = CBBTC_USDC_MARKET_PARAMS.lltv,
): bigint {
  const colValue = collateralValueInLoan(collateralAmount, oraclePrice);
  const maxLtv =
    (lltv * BigInt(Math.round(MAX_BORROW_LTV_RATIO * 1e4))) / BigInt(10000);
  return (colValue * maxLtv) / WAD;
}
