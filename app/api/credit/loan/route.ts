import { prisma } from "@/lib/prisma";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!row)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const loans = await prisma.creditLoan.findMany({
    where: { userId: row.id },
    orderBy: { openedAt: "desc" },
  });

  return NextResponse.json({ loans });
}

export async function POST(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!row)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const { walletAddress, collateralRaw, borrowRaw, lockTxHash, borrowTxHash } =
    body;

  if (
    !walletAddress ||
    !collateralRaw ||
    !borrowRaw ||
    !lockTxHash ||
    !borrowTxHash
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const loan = await prisma.creditLoan.create({
    data: {
      userId: row.id,
      walletAddress,
      collateralRaw: String(collateralRaw),
      borrowRaw: String(borrowRaw),
      lockTxHash,
      borrowTxHash,
      status: "active",
    },
  });

  return NextResponse.json({ loan }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!row)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const { loanId, settleTxHash } = body;

  if (!loanId || !settleTxHash) {
    return NextResponse.json(
      { error: "Missing loanId or settleTxHash" },
      { status: 400 },
    );
  }

  const existing = await prisma.creditLoan.findFirst({
    where: { id: loanId, userId: row.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });

  const loan = await prisma.creditLoan.update({
    where: { id: loanId },
    data: {
      settleTxHash,
      status: "fulfilled",
      settledAt: new Date(),
    },
  });

  return NextResponse.json({ loan });
}
