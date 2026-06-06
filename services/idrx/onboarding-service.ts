import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  displayNameFromPrivy,
  emailFromPrivy,
  fullNameForIdrxOnboarding,
} from "@/lib/user-display";
import { ServiceError } from "@/services/errors";
import { idrxOnboardingMultipart } from "@/services/idrx/client";
import { placeholderIdPngBlob } from "@/services/idrx/placeholder-id-image";
import type { User } from "@privy-io/server-auth";

export type IdrxOnboardingStatus = {
  completed: boolean;
  idrxUserId: number | null;
  walletAddress: string | null;
};

/** Preflight: does the user already have IDRX credentials stored. */
export async function getIdrxOnboardingStatus(
  privyUser: User,
): Promise<IdrxOnboardingStatus> {
  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });

  const completed = Boolean(
    row?.onboardingCompletedAt && row?.idrxApiKeyEnc && row?.idrxApiSecretEnc,
  );

  return {
    completed,
    idrxUserId: row?.idrxUserId ?? null,
    walletAddress: row?.walletAddress ?? null,
  };
}

export type IdrxOnboardingResult = {
  idrxUserId: number;
  fullname?: string;
  createdAt?: string;
};

/**
 * Minimal IDRX onboarding: email from Privy, other fields "" + placeholder ID
 * image (multipart). No user-provided KYC. Stores encrypted per-user creds.
 */
export async function runIdrxOnboarding(
  privyUser: User,
): Promise<IdrxOnboardingResult> {
  const email = emailFromPrivy(privyUser)?.trim();
  if (!email) {
    throw new ServiceError(400, "Email tidak tersedia dari akun Privy");
  }

  const fullname = fullNameForIdrxOnboarding(privyUser);
  const idFile = placeholderIdPngBlob();

  let idrxRes;
  try {
    idrxRes = await idrxOnboardingMultipart({
      email,
      fullname,
      address: "",
      idNumber: "",
      idFile,
      idFileName: "placeholder.png",
    });
  } catch (e) {
    console.error(e);
    throw new ServiceError(502, "Gagal menghubungi layanan IDRX");
  }

  if (
    idrxRes.statusCode !== 201 ||
    !idrxRes.data?.apiKey ||
    !idrxRes.data?.apiSecret
  ) {
    throw new ServiceError(
      400,
      idrxRes.message === "success"
        ? "Onboarding ditolak"
        : idrxRes.message || "Onboarding gagal",
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

  return {
    idrxUserId: idrxRes.data.id,
    fullname: idrxRes.data.fullname,
    createdAt: idrxRes.data.createdAt,
  };
}

/** Ensure the user is onboarded with IDRX, running onboarding if needed. */
export async function ensureIdrxOnboarding(
  privyUser: User,
): Promise<IdrxOnboardingStatus> {
  const status = await getIdrxOnboardingStatus(privyUser);
  if (status.completed) return status;
  await runIdrxOnboarding(privyUser);
  return getIdrxOnboardingStatus(privyUser);
}
