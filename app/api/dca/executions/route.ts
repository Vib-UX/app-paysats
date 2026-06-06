import { errorMessage, ServiceError } from "@/services/errors";
import { getDcaExecutions } from "@/services/dca/executions-service";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * GET /api/dca/executions
 *
 * Returns all known DCAExecuted swaps for the caller's smart wallet. See
 * services/dca/executions-service.ts for the scan/backfill logic.
 */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getDcaExecutions(privyUser);
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof ServiceError ? e.status : 502;
    return NextResponse.json(
      { error: errorMessage(e, "Gagal memuat riwayat swap") },
      { status },
    );
  }
}
