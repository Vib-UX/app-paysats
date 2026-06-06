import { errorMessage, ServiceError } from "@/services/errors";
import { listMintTransactions } from "@/services/idrx/transactions-service";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ob = searchParams.get("orderByDate");
  const orderByDate: "ASC" | "DESC" | undefined =
    ob === "ASC" || ob === "DESC" ? ob : undefined;

  try {
    const result = await listMintTransactions(privyUser, {
      page: Number(searchParams.get("page") || "1"),
      take: Number(searchParams.get("take") || "20"),
      merchantOrderId: searchParams.get("merchantOrderId")?.trim() || undefined,
      reference: searchParams.get("reference")?.trim() || undefined,
      paymentStatus: searchParams.get("paymentStatus")?.trim() || undefined,
      userMintStatus: searchParams.get("userMintStatus")?.trim() || undefined,
      orderByDate,
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof ServiceError ? e.status : 500;
    return NextResponse.json(
      { error: errorMessage(e, "Gagal memuat riwayat"), transactions: [] },
      { status },
    );
  }
}
