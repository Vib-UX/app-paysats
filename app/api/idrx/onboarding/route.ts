import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { displayNameFromPrivy, emailFromPrivy } from "@/lib/user-display";
import { idrxOnboardingMultipart } from "@/services/idrx/client";
import { placeholderIdPngBlob } from "@/services/idrx/placeholder-id-image";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Preflight: apakah user sudah punya kredensial IDRX. */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });

  const completed = Boolean(
    row?.onboardingCompletedAt &&
      row?.idrxApiKeyEnc &&
      row?.idrxApiSecretEnc,
  );

  return NextResponse.json({
    completed,
    idrxUserId: row?.idrxUserId ?? null,
    walletAddress: row?.walletAddress ?? null,
  });
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

  const email = emailFromPrivy(privyUser)?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "Email tidak tersedia dari akun Privy" },
      { status: 400 },
    );
  }

  const fullname = "";
  const address = "";
  const idNumber = "";
  const idFile = placeholderIdPngBlob();

  let idrxRes;
  try {
    idrxRes = await idrxOnboardingMultipart({
      email,
      fullname,
      address,
      idNumber,
      idFile,
      idFileName: "placeholder.png",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gagal menghubungi layanan IDRX" },
      { status: 502 },
    );
  }

  if (idrxRes.statusCode !== 201 || !idrxRes.data?.apiKey || !idrxRes.data?.apiSecret) {
    return NextResponse.json(
      {
        error:
          idrxRes.message === "success"
            ? "Onboarding ditolak"
            : idrxRes.message || "Onboarding gagal",
      },
      { status: 400 },
    );
  }

  const keyEnc = encryptSecret(idrxRes.data.apiKey);
  const secretEnc = encryptSecret(idrxRes.data.apiSecret);
  const displayName = displayNameFromPrivy(privyUser);

  await prisma.user.upsert({
    where: { privyUserId: privyUser.id },
    create: {
      privyUserId: privyUser.id,
      email,
      displayName: displayName ?? undefined,
      idrxUserId: idrxRes.data.id,
      idrxApiKeyEnc: keyEnc,
      idrxApiSecretEnc: secretEnc,
      onboardingCompletedAt: new Date(),
    },
    update: {
      email,
      displayName: displayName ?? undefined,
      idrxUserId: idrxRes.data.id,
      idrxApiKeyEnc: keyEnc,
      idrxApiSecretEnc: secretEnc,
      onboardingCompletedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    idrxUserId: idrxRes.data.id,
    fullname: idrxRes.data.fullname,
    createdAt: idrxRes.data.createdAt,
  });
}
