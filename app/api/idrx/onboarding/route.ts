import { errorMessage, ServiceError } from "@/services/errors";
import {
  getIdrxOnboardingStatus,
  runIdrxOnboarding,
} from "@/services/idrx/onboarding-service";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Preflight: apakah user sudah punya kredensial IDRX. */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getIdrxOnboardingStatus(privyUser);
  return NextResponse.json(status);
}

/**
 * Onboarding minimal: email dari Privy (server), field lain "" + placeholder
 * gambar (multipart IDRX). Tanpa KYC dari pengguna.
 */
export async function POST(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIdrxOnboarding(privyUser);
    return NextResponse.json({
      ok: true,
      idrxUserId: result.idrxUserId,
      fullname: result.fullname,
      createdAt: result.createdAt,
      credentialsStored: true,
    });
  } catch (e) {
    const status = e instanceof ServiceError ? e.status : 500;
    return NextResponse.json(
      { error: errorMessage(e, "Onboarding gagal") },
      { status },
    );
  }
}
