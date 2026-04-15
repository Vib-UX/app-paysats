import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { idrxMintRequest } from "@/services/idrx/client";
import {
  getPreferredEthereumAddress,
  getPrivyUserFromRequest,
} from "@/services/privy/server";
import { assertEvmAddress } from "@/services/wallet";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Body = {
  toBeMinted: string;
  expiryPeriod: number;
  networkChainId?: string;
  requestType?: string;
  destinationWalletAddress?: string;
};

const MIN_IDR = 20_000;
const MAX_IDR = 1_000_000_000;

export async function POST(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!row?.onboardingCompletedAt || !row.idrxApiKeyEnc || !row.idrxApiSecretEnc) {
    return NextResponse.json({ error: "Selesaikan onboarding terlebih dahulu" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const amountNum = Number(String(body.toBeMinted).replace(/\./g, "").replace(/,/g, ""));
  if (!Number.isFinite(amountNum) || amountNum < MIN_IDR || amountNum > MAX_IDR) {
    return NextResponse.json(
      { error: `Nominal harus antara Rp ${MIN_IDR.toLocaleString("id-ID")} dan Rp ${MAX_IDR.toLocaleString("id-ID")}` },
      { status: 400 },
    );
  }

  const expiry = Number(body.expiryPeriod);
  if (!Number.isFinite(expiry) || expiry < 300 || expiry > 86400 * 2) {
    return NextResponse.json(
      { error: "Periode kedaluwarsa tidak valid (300 detik – 48 jam)" },
      { status: 400 },
    );
  }

  const preferred = getPreferredEthereumAddress(privyUser);
  const dest =
    body.destinationWalletAddress?.trim() ||
    preferred ||
    row.walletAddress ||
    "";
  if (!dest) {
    return NextResponse.json(
      { error: "Dompet belum siap. Tunggu sebentar lalu coba lagi." },
      { status: 400 },
    );
  }

  try {
    assertEvmAddress(dest);
  } catch {
    return NextResponse.json({ error: "Alamat dompet tidak valid" }, { status: 400 });
  }

  const apiKey = decryptSecret(row.idrxApiKeyEnc);
  const apiSecret = decryptSecret(row.idrxApiSecretEnc);

  const networkChainId =
    body.networkChainId?.trim() ||
    process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ||
    "8453";

  let mintRes;
  try {
    mintRes = await idrxMintRequest(apiKey, apiSecret, {
      toBeMinted: String(Math.floor(amountNum)),
      destinationWalletAddress: dest,
      expiryPeriod: Math.floor(expiry),
      networkChainId,
      requestType: body.requestType,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Gagal membuat permintaan mint" }, { status: 502 });
  }

  if (mintRes.statusCode !== 200 || !mintRes.data) {
    return NextResponse.json(
      { error: mintRes.message || "Mint request ditolak" },
      { status: 400 },
    );
  }

  await prisma.mintRequestSnapshot.create({
    data: {
      userId: row.id,
      reference: mintRes.data.reference,
      merchantOrderId: mintRes.data.merchantOrderId,
      toBeMinted: String(Math.floor(amountNum)),
      paymentAmount: mintRes.data.amount,
      paymentUrl: mintRes.data.paymentUrl,
      networkChainId,
    },
  });

  return NextResponse.json({
    paymentUrl: mintRes.data.paymentUrl,
    amount: mintRes.data.amount,
    reference: mintRes.data.reference,
    merchantOrderId: mintRes.data.merchantOrderId,
    statusMessage: mintRes.data.statusMessage,
    statusCode: mintRes.data.statusCode,
  });
}
