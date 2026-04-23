import { prisma } from "@/lib/prisma";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type PreferencesBody = {
  currencyPreference?: "IDR" | "USD";
  displayUnit?: "SATS" | "BTC";
  completeOnboarding?: boolean;
};

export async function PATCH(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PreferencesBody = {};
  try {
    body = (await request.json()) as PreferencesBody;
  } catch {
    /* optional body */
  }

  const data: {
    currencyPreference?: "IDR" | "USD";
    displayUnit?: "SATS" | "BTC";
    onboardingCompletedAt?: Date;
  } = {};

  if (
    body.currencyPreference === "IDR" ||
    body.currencyPreference === "USD"
  ) {
    data.currencyPreference = body.currencyPreference;
  }

  if (body.displayUnit === "SATS" || body.displayUnit === "BTC") {
    data.displayUnit = body.displayUnit;
  }

  if (body.completeOnboarding === true) {
    data.onboardingCompletedAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.upsert({
    where: { privyUserId: privyUser.id },
    create: {
      privyUserId: privyUser.id,
      ...data,
    },
    update: data,
  });

  return NextResponse.json({
    ok: true,
    currencyPreference: updated.currencyPreference ?? null,
    displayUnit: updated.displayUnit ?? null,
    onboardingCompleted: Boolean(updated.onboardingCompletedAt),
  });
}
