import { prisma } from "@/lib/prisma";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * GET /api/credit/redeem — list the caller's local redeem snapshots.
 */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const redeems = await prisma.redeemRequest.findMany({
    where: { userId: row.id },
    orderBy: { createdAt: "desc" },
    include: {
      payoutDestination: {
        select: {
          id: true,
          kind: true,
          bankName: true,
          bankAccountName: true,
          bankAccountNumberLast: true,
        },
      },
    },
  });

  return NextResponse.json({ redeems });
}

/**
 * POST /api/credit/redeem
 * Body: {
 *   payoutDestinationId: string,
 *   transferTxHash: string,
 *   walletAddress: string,
 *   usdcAmountRaw: string,
 *   idrQuoteRaw?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRow = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: {
    payoutDestinationId?: string;
    transferTxHash?: string;
    walletAddress?: string;
    usdcAmountRaw?: string;
    idrQuoteRaw?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  if (
    !body.payoutDestinationId ||
    !body.transferTxHash ||
    !body.walletAddress ||
    !body.usdcAmountRaw
  ) {
    return NextResponse.json(
      { error: "Field wajib kurang" },
      { status: 400 },
    );
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(body.transferTxHash)) {
    return NextResponse.json(
      { error: "transferTxHash tidak valid" },
      { status: 400 },
    );
  }

  const destination = await prisma.payoutDestination.findFirst({
    where: { id: body.payoutDestinationId, userId: userRow.id },
  });
  if (!destination) {
    return NextResponse.json(
      { error: "Tujuan payout tidak ditemukan" },
      { status: 404 },
    );
  }

  const redeem = await prisma.redeemRequest.create({
    data: {
      userId: userRow.id,
      payoutDestinationId: destination.id,
      transferTxHash: body.transferTxHash,
      walletAddress: body.walletAddress,
      usdcAmountRaw: String(body.usdcAmountRaw),
      idrQuoteRaw: body.idrQuoteRaw ? String(body.idrQuoteRaw) : null,
      status: "sent",
    },
  });

  return NextResponse.json({ redeem }, { status: 201 });
}
