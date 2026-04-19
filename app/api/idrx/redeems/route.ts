import { prisma } from "@/lib/prisma";
import { idrxDepositRedeemHistory } from "@/services/idrx/bank-accounts";
import {
  deriveOfframpStage,
  type OfframpSettlement,
} from "@/services/idrx/offramp-settlement";
import type { IdrxDepositRedeemRecord } from "@/services/idrx/types";
import { loadUserIdrxContext } from "@/services/idrx/user-credentials";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type RedeemViewRecord = IdrxDepositRedeemRecord & {
  settlement: OfframpSettlement;
};

/**
 * GET /api/idrx/redeems
 *
 * Proxies IDRX DEPOSIT_REDEEM history, annotates each record with a coarse
 * settlement stage, and reconciles against our local RedeemRequest snapshots
 * (matching on transferTxHash) so we can update status + capture
 * depositRedeemId.
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
  const page = Number(searchParams.get("page") ?? "1");
  const take = Math.min(50, Math.max(1, Number(searchParams.get("take") ?? "20")));
  const transferTxHash = searchParams.get("transferTxHash") ?? undefined;

  let idrxRes;
  try {
    idrxRes = await idrxDepositRedeemHistory(ctx.apiKey, ctx.apiSecret, {
      page,
      take,
      transferTxHash,
      orderByDate: "DESC",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gagal mengambil riwayat redeem" },
      { status: 502 },
    );
  }

  if (idrxRes.statusCode !== 200) {
    return NextResponse.json(
      { error: idrxRes.message || "Gagal mengambil riwayat redeem" },
      { status: 502 },
    );
  }

  const records = idrxRes.records ?? [];
  const annotated: RedeemViewRecord[] = records.map((r) => ({
    ...r,
    settlement: deriveOfframpStage(r),
  }));

  // Reconcile against local snapshots (match on transferTxHash lowercased).
  // Intentionally include rows previously marked "failed" — historically a
  // transient IDRX status could flip us to failed even while the redemption
  // was still progressing, and we want to self-heal once IDRX reports SUCCESS.
  // Only "settled" is treated as a sticky terminal state locally.
  const localRows = await prisma.redeemRequest.findMany({
    where: {
      userId: ctx.userRow.id,
      status: { in: ["sent", "settled", "failed"] },
    },
  });
  if (localRows.length > 0) {
    const byHash = new Map(
      annotated.map((r) => [r.transferTxHash.toLowerCase(), r] as const),
    );
    await Promise.all(
      localRows.map(async (row) => {
        const match = byHash.get(row.transferTxHash.toLowerCase());
        if (!match) return;

        // Once IDRX confirms disbursement, we honour it regardless of prior
        // local status (including a previously-stuck "failed").
        const nextStatus =
          match.settlement.stage === "disbursed"
            ? "settled"
            : match.settlement.stage === "failed"
              ? "failed"
              : row.status === "failed"
                ? "sent" // heal: IDRX is back to making progress
                : row.status;

        if (
          row.status !== nextStatus ||
          row.depositRedeemId !== match.id
        ) {
          await prisma.redeemRequest.update({
            where: { id: row.id },
            data: {
              status: nextStatus,
              depositRedeemId: match.id,
              settledAt:
                nextStatus === "settled" && !row.settledAt
                  ? new Date()
                  : row.settledAt,
            },
          });
        }
      }),
    );
  }

  return NextResponse.json({
    records: annotated,
    metadata: idrxRes.metadata,
  });
}
