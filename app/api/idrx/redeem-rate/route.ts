import { createSignature } from "@/services/idrx/signature";
import { getIdrxBaseUrl } from "@/services/idrx/client";
import { loadUserIdrxContext } from "@/services/idrx/user-credentials";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * GET /api/idrx/redeem-rate?usdAmount=123.45
 *
 * Returns an expected IDR payout for a given USDC amount on Base, plus any
 * IDRX redeem fees.
 *
 * IDRX has a rates endpoint for partner-stablecoin redemption but the exact
 * path isn't in our copy of the docs yet. We try a couple of plausible paths
 * and fall back to a static rate (env `IDRX_USDC_IDR_RATE`, default 16,500)
 * so the UI can always render a quote. The response always flags
 * `source: 'idrx' | 'fallback'` so callers can show a "perkiraan" hint.
 */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await loadUserIdrxContext(privyUser);
  if (!ctx) {
    return NextResponse.json(
      { error: "Selesaikan onboarding terlebih dahulu" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const usdAmount = Number(searchParams.get("usdAmount") ?? "0");
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return NextResponse.json(
      { error: "usdAmount harus > 0" },
      { status: 400 },
    );
  }

  const base = getIdrxBaseUrl();
  const fetchFees = async () => {
    const path = `/api/transaction/get-additional-fees?feeType=REDEEM`;
    const fullUrl = `${base}${path}`;
    const timestamp = String(Math.round(Date.now()));
    const sig = createSignature("GET", fullUrl, {}, timestamp, ctx.apiSecret);
    try {
      const res = await fetch(fullUrl, {
        headers: {
          "Content-Type": "application/json",
          "idrx-api-key": ctx.apiKey,
          "idrx-api-sig": sig,
          "idrx-api-ts": timestamp,
        },
      });
      const json = (await res.json()) as {
        statusCode?: number;
        data?: {
          id: number;
          name: string;
          amount: string;
          isActive: boolean;
        }[];
      };
      if (json.statusCode !== 200 || !json.data) return 0;
      return json.data
        .filter((f) => f.isActive)
        .reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
    } catch {
      return 0;
    }
  };

  const candidatePaths = [
    `/api/transaction/rates?tokenFrom=usdc&amount=${encodeURIComponent(
      String(usdAmount),
    )}&chainId=8453`,
    `/api/transaction/get-swap-rate?tokenFrom=usdc&amount=${encodeURIComponent(
      String(usdAmount),
    )}&chainId=8453`,
    `/api/transaction/swap-rate?tokenFrom=usdc&amount=${encodeURIComponent(
      String(usdAmount),
    )}&chainId=8453`,
  ];

  for (const path of candidatePaths) {
    const fullUrl = `${base}${path}`;
    const timestamp = String(Math.round(Date.now()));
    const sig = createSignature("GET", fullUrl, {}, timestamp, ctx.apiSecret);
    try {
      const res = await fetch(fullUrl, {
        headers: {
          "Content-Type": "application/json",
          "idrx-api-key": ctx.apiKey,
          "idrx-api-sig": sig,
          "idrx-api-ts": timestamp,
        },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        statusCode?: number;
        data?: unknown;
      };
      if (json.statusCode !== 200 || !json.data) continue;
      const data = json.data as Record<string, unknown>;
      const out =
        Number(
          (data.amountTo as string | number | undefined) ??
            (data.amountIdrx as string | number | undefined) ??
            (data.expectedOut as string | number | undefined) ??
            0,
        ) || 0;
      const rate =
        Number(
          (data.rate as string | number | undefined) ??
            (data.price as string | number | undefined) ??
            0,
        ) || (out > 0 ? out / usdAmount : 0);
      if (out > 0) {
        const feeIdr = await fetchFees();
        return NextResponse.json({
          source: "idrx",
          usdAmount,
          expectedIdr: Math.max(0, Math.floor(out - feeIdr)),
          grossIdr: Math.floor(out),
          feeIdr,
          rate,
        });
      }
    } catch {
      // try next path
    }
  }

  // Fallback: static rate
  const fallbackRate = Number(process.env.IDRX_USDC_IDR_RATE ?? "16500");
  const rate = Number.isFinite(fallbackRate) && fallbackRate > 0
    ? fallbackRate
    : 16_500;
  const gross = Math.floor(usdAmount * rate);
  const feeIdr = await fetchFees();

  return NextResponse.json({
    source: "fallback",
    usdAmount,
    expectedIdr: Math.max(0, gross - feeIdr),
    grossIdr: gross,
    feeIdr,
    rate,
  });
}
