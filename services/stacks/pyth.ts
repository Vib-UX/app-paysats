import {
  PYTH_FEED_ID_BTC,
  PYTH_FEED_ID_USDC,
  PYTH_LAZER_FEED_BTC,
  PYTH_LAZER_FEED_USDC,
} from "@/lib/stacks/config";
import { ServiceError } from "@/services/errors";

/**
 * Since the Pyth Core upgrade (2026-08-26) every Hermes request needs a Pyth
 * API key; the legacy unauthenticated `hermes.pyth.network` host answers 401.
 *
 * Pro/Lazer keys are not always entitled for Hermes Core crypto spot feeds
 * ("Not entitled… no grant accepts this feed"). Spot reads therefore fall
 * back to Coinbase when Hermes rejects the key — Lazer is still required for
 * on-chain Zest writes.
 */
const HERMES_BASE = (
  process.env.PYTH_HERMES_BASE ?? "https://pyth.dourolabs.app/hermes"
).replace(/\/+$/, "");

function pythApiKey(): string | null {
  const key = (
    process.env.PYTH_API_KEY ??
    process.env.PYTH_LAZER_API_KEY ??
    process.env.PYTH_PRO_API_KEY ??
    ""
  ).trim();
  return key.length > 0 ? key : null;
}

export type PythSpotPrices = {
  btcUsd: number;
  usdcUsd: number;
  publishTime: number;
  /** Where the off-chain quote came from (Hermes preferred, Coinbase fallback). */
  source: "hermes" | "coinbase";
};

type HermesParsed = {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
};

type HermesResponse = {
  binary?: { encoding?: string; data?: string[] };
  parsed?: HermesParsed[];
};

function pythPriceToUsd(price: string, expo: number): number {
  const n = Number(price);
  if (!Number.isFinite(n)) return 0;
  return n * 10 ** expo;
}

function isEntitlementError(status: number, body: string): boolean {
  if (status !== 403 && status !== 401) return false;
  return /not entitled|no grant|unauthorized|invalid api key/i.test(body);
}

async function fetchCoinbaseSpotPrices(): Promise<PythSpotPrices> {
  const [btcRes, usdcRes] = await Promise.all([
    fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch("https://api.coinbase.com/v2/prices/USDC-USD/spot", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  ]);
  if (!btcRes.ok || !usdcRes.ok) {
    throw new ServiceError(
      502,
      "Could not load BTC/USDC prices. Try again in a moment.",
      { errorKey: "error.pythPriceUnavailable" },
    );
  }
  const btcJson = (await btcRes.json()) as {
    data?: { amount?: string };
  };
  const usdcJson = (await usdcRes.json()) as {
    data?: { amount?: string };
  };
  const btcUsd = Number(btcJson.data?.amount);
  const usdcUsd = Number(usdcJson.data?.amount);
  if (!Number.isFinite(btcUsd) || btcUsd <= 0) {
    throw new ServiceError(502, "Could not load BTC price", {
      errorKey: "error.pythPriceUnavailable",
    });
  }
  return {
    btcUsd,
    usdcUsd: Number.isFinite(usdcUsd) && usdcUsd > 0 ? usdcUsd : 1,
    publishTime: Math.floor(Date.now() / 1000),
    source: "coinbase",
  };
}

async function fetchHermesSpotPrices(
  token: string,
): Promise<PythSpotPrices> {
  const ids = [PYTH_FEED_ID_BTC, PYTH_FEED_ID_USDC]
    .map((id) => `ids[]=${encodeURIComponent(id)}`)
    .join("&");
  const url = `${HERMES_BASE}/v2/updates/price/latest?${ids}&encoding=hex&parsed=true`;

  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    if (isEntitlementError(res.status, detail)) {
      throw new ServiceError(
        502,
        "Pyth API key is not entitled for crypto spot price feeds",
        { errorKey: "error.pythNotEntitled" },
      );
    }
    throw new ServiceError(
      502,
      `Hermes price fetch failed (${res.status})`,
      { errorKey: "error.pythPriceUnavailable" },
    );
  }

  const json = (await res.json()) as HermesResponse;
  const parsed = json.parsed ?? [];
  const btc = parsed.find((p) => p.id.includes("e62df6c8"));
  const usdc = parsed.find((p) => p.id.includes("eaa020c6"));
  if (!btc || !usdc) {
    throw new ServiceError(502, "Hermes did not return BTC/USDC prices", {
      errorKey: "error.pythPriceUnavailable",
    });
  }

  return {
    btcUsd: pythPriceToUsd(btc.price.price, btc.price.expo),
    usdcUsd: pythPriceToUsd(usdc.price.price, usdc.price.expo),
    publishTime: Math.max(btc.price.publish_time, usdc.price.publish_time),
    source: "hermes",
  };
}

/**
 * Latest BTC + USDC spot prices for off-chain Zest LTV / preview math.
 * Prefers Hermes; falls back to Coinbase when the Pyth key lacks Core
 * crypto-spot grants (common with Lazer-only Pro keys).
 */
export async function fetchPythSpotPrices(): Promise<PythSpotPrices> {
  const token = pythApiKey();
  if (token) {
    try {
      return await fetchHermesSpotPrices(token);
    } catch (e) {
      // Fall through to Coinbase for entitlement / Hermes outages only.
      if (!(e instanceof ServiceError) || e.status !== 502) throw e;
    }
  }

  return fetchCoinbaseSpotPrices();
}

const LAZER_REST = "https://pyth-lazer.dourolabs.app/v1/latest_price";
/** EVM Lazer envelope magic `0x2a22999a` (see stx-labs/stacks-pyth-lazer). */
const LAZER_EVM_MAGIC = "2a22999a";

function extractLazerEvmHex(json: unknown): string | null {
  const fromEvm = (o: Record<string, unknown>): string | null => {
    const evm = o.evm;
    if (evm && typeof evm === "object") {
      const data = (evm as { data?: unknown }).data;
      if (typeof data === "string" && data.length > 8) {
        return data.replace(/^0x/i, "");
      }
    }
    if (typeof o.data === "string" && o.data.length > 8) {
      return o.data.replace(/^0x/i, "");
    }
    return null;
  };

  if (Array.isArray(json)) {
    for (const item of json) {
      const hex = extractLazerEvmHex(item);
      if (hex) return hex;
    }
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  const direct = fromEvm(rec);
  if (direct) return direct;
  for (const key of ["message", "messages", "payload", "result", "data"]) {
    const nested = extractLazerEvmHex(rec[key]);
    if (nested) return nested;
  }
  return null;
}

/**
 * One Pyth Pro (Lazer) EVM update for the Zest market.
 * Hermes PNAU is rejected on-chain (err u400022).
 */
export async function fetchPythPriceFeedHexes(): Promise<string[]> {
  const token = pythApiKey();
  if (!token) {
    throw new ServiceError(
      500,
      "Set PYTH_API_KEY (Pyth Pro / Lazer) to attach Zest price feeds",
      { errorKey: "error.pythKeyMissing" },
    );
  }

  const res = await fetch(LAZER_REST, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Isolated sBTC → USDCx only needs BTC (1) and USDC (7). STX (45) is
      // accepted on-chain if present, but demo Pro keys often lack that grant.
      priceFeedIds: [PYTH_LAZER_FEED_BTC, PYTH_LAZER_FEED_USDC],
      properties: [
        "price",
        "exponent",
        "confidence",
        "publisherCount",
        "feedUpdateTimestamp",
      ],
      formats: ["evm"],
      jsonBinaryEncoding: "hex",
      channel: "fixed_rate@200ms",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    if (isEntitlementError(res.status, text)) {
      throw new ServiceError(
        502,
        "Pyth API key is not entitled for crypto spot price feeds (Lazer)",
        { errorKey: "error.pythNotEntitled" },
      );
    }
    throw new ServiceError(
      502,
      `Pyth Lazer fetch failed (${res.status})`,
      { errorKey: "error.pythPriceUnavailable" },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new ServiceError(502, "Pyth Lazer returned non-JSON", {
      errorKey: "error.pythPriceUnavailable",
    });
  }

  const hex = extractLazerEvmHex(json)?.toLowerCase() ?? null;
  if (!hex || !hex.startsWith(LAZER_EVM_MAGIC)) {
    throw new ServiceError(502, "Pyth Lazer did not return an EVM price update", {
      errorKey: "error.pythPriceUnavailable",
    });
  }
  if (hex.length / 2 > 8192) {
    throw new ServiceError(502, "Pyth Lazer update exceeds Zest's 8192-byte cap", {
      errorKey: "error.pythPriceUnavailable",
    });
  }

  return [hex];
}
