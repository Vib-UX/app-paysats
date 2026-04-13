import { prisma } from "@/lib/prisma";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });

  return NextResponse.json({
    privyUserId: privyUser.id,
    email: row?.email ?? null,
    displayName: row?.displayName ?? null,
    walletAddress: row?.walletAddress ?? null,
    onboardingCompleted: Boolean(row?.onboardingCompletedAt),
    idrxUserId: row?.idrxUserId ?? null,
  });
}
