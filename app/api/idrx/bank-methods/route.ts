import { idrxListBankMethods } from "@/services/idrx/bank-accounts";
import { classifyMethods } from "@/services/idrx/payout-methods";
import { loadUserIdrxContext } from "@/services/idrx/user-credentials";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * GET /api/idrx/bank-methods?kind=bank|ewallet|all
 *
 * Lists the IDRX supported bank / e-wallet catalogue. Each entry is annotated
 * with `kind` via the local classifier. Responses are cacheable on the client
 * for up to 24h — the catalogue is shared and rarely changes.
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
  const kindParam = (searchParams.get("kind") ?? "all").toLowerCase();
  const wantKind: "bank" | "ewallet" | "all" =
    kindParam === "bank" || kindParam === "ewallet" ? kindParam : "all";

  let raw;
  try {
    raw = await idrxListBankMethods(ctx.apiKey, ctx.apiSecret);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gagal mengambil daftar metode IDRX" },
      { status: 502 },
    );
  }

  if (raw.statusCode !== 200 || !raw.data) {
    return NextResponse.json(
      { error: raw.message || "Gagal mengambil daftar metode IDRX" },
      { status: 502 },
    );
  }

  const classified = classifyMethods(raw.data);
  const filtered =
    wantKind === "all"
      ? classified
      : classified.filter((m) => m.kind === wantKind);

  const response = NextResponse.json({ methods: filtered });
  response.headers.set(
    "Cache-Control",
    "private, max-age=300, stale-while-revalidate=86400",
  );
  return response;
}
