import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { idrxUserTransactionHistory } from "@/services/idrx/client";
import { normalizeMintRecord } from "@/services/idrx/normalize";
import { deriveMintSettlement } from "@/services/idrx/settlement";
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
  if (!row?.idrxApiKeyEnc || !row.idrxApiSecretEnc) {
    return NextResponse.json({ error: "Onboarding IDRX belum selesai" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const take = Math.min(50, Math.max(1, Number(searchParams.get("take") || "20") || 20));
  const merchantOrderId = searchParams.get("merchantOrderId")?.trim() || undefined;
  const reference = searchParams.get("reference")?.trim() || undefined;
  const paymentStatus = searchParams.get("paymentStatus")?.trim() || undefined;
  const userMintStatus = searchParams.get("userMintStatus")?.trim() || undefined;
  const ob = searchParams.get("orderByDate");
  const orderByDate: "ASC" | "DESC" | undefined =
    ob === "ASC" || ob === "DESC" ? ob : undefined;

  const apiKey = decryptSecret(row.idrxApiKeyEnc);
  const apiSecret = decryptSecret(row.idrxApiSecretEnc);

  let hist;
  try {
    hist = await idrxUserTransactionHistory(apiKey, apiSecret, {
      transactionType: "MINT",
      page,
      take,
      merchantOrderId,
      reference,
      paymentStatus,
      userMintStatus,
      orderByDate,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal memuat riwayat" }, { status: 502 });
  }

  if (hist.statusCode !== 200 || !hist.records) {
    return NextResponse.json(
      {
        error: hist.message || "Riwayat tidak tersedia",
        transactions: [],
        metadata: hist.metadata,
      },
      { status: 200 },
    );
  }

  const transactions = hist.records.map((r) => {
    const t = normalizeMintRecord(r);
    return { ...t, settlement: deriveMintSettlement(t) };
  });

  return NextResponse.json({
    transactions,
    metadata: hist.metadata,
  });
}
