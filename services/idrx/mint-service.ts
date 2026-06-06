import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/services/errors";
import { idrxMintRequest } from "@/services/idrx/client";
import {
  getPreferredEthereumAddress,
} from "@/services/privy/server";
import { assertEvmAddress } from "@/services/wallet";
import type { User } from "@privy-io/server-auth";

export const MINT_MIN_IDR = 20_000;
export const MINT_MAX_IDR = 1_000_000_000;
export const MINT_DEFAULT_EXPIRY_SEC = 3_600;

export type CreateMintParams = {
  /** IDR amount as a number or numeric string (dots/commas tolerated). */
  toBeMinted: string | number;
  expiryPeriod?: number;
  networkChainId?: string;
  requestType?: string;
  /** Override destination; defaults to the user's smart wallet. */
  destinationWalletAddress?: string;
};

export type CreateMintResult = {
  paymentUrl: string;
  amount?: string;
  reference?: string;
  merchantOrderId?: string;
  statusMessage?: string;
  statusCode?: string;
  destinationWalletAddress: string;
  networkChainId: string;
};

export async function createIdrMintRequest(
  privyUser: User,
  params: CreateMintParams,
): Promise<CreateMintResult> {
  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!row?.onboardingCompletedAt || !row.idrxApiKeyEnc || !row.idrxApiSecretEnc) {
    throw new ServiceError(403, "Selesaikan onboarding terlebih dahulu");
  }

  const amountNum = Number(
    String(params.toBeMinted).replace(/\./g, "").replace(/,/g, ""),
  );
  if (
    !Number.isFinite(amountNum) ||
    amountNum < MINT_MIN_IDR ||
    amountNum > MINT_MAX_IDR
  ) {
    throw new ServiceError(
      400,
      `Nominal harus antara Rp ${MINT_MIN_IDR.toLocaleString("id-ID")} dan Rp ${MINT_MAX_IDR.toLocaleString("id-ID")}`,
    );
  }

  const expiry = Number(params.expiryPeriod ?? MINT_DEFAULT_EXPIRY_SEC);
  if (!Number.isFinite(expiry) || expiry < 300 || expiry > 86400 * 2) {
    throw new ServiceError(
      400,
      "Periode kedaluwarsa tidak valid (300 detik – 48 jam)",
    );
  }

  const preferred = getPreferredEthereumAddress(privyUser);
  const dest =
    params.destinationWalletAddress?.trim() ||
    preferred ||
    row.walletAddress ||
    "";
  if (!dest) {
    throw new ServiceError(
      400,
      "Dompet belum siap. Tunggu sebentar lalu coba lagi.",
    );
  }
  try {
    assertEvmAddress(dest);
  } catch {
    throw new ServiceError(400, "Alamat dompet tidak valid");
  }

  const apiKey = decryptSecret(row.idrxApiKeyEnc);
  const apiSecret = decryptSecret(row.idrxApiSecretEnc);

  const networkChainId =
    params.networkChainId?.trim() ||
    process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ||
    "8453";

  let mintRes;
  try {
    mintRes = await idrxMintRequest(apiKey, apiSecret, {
      toBeMinted: String(Math.floor(amountNum)),
      destinationWalletAddress: dest,
      expiryPeriod: Math.floor(expiry),
      networkChainId,
      requestType: params.requestType ?? "idrx",
    });
  } catch (e) {
    console.error(e);
    throw new ServiceError(502, "Gagal membuat permintaan mint");
  }

  if (mintRes.statusCode !== 200 || !mintRes.data) {
    throw new ServiceError(400, mintRes.message || "Mint request ditolak");
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

  return {
    paymentUrl: mintRes.data.paymentUrl,
    amount: mintRes.data.amount,
    reference: mintRes.data.reference,
    merchantOrderId: mintRes.data.merchantOrderId,
    statusMessage: mintRes.data.statusMessage,
    statusCode: mintRes.data.statusCode,
    destinationWalletAddress: dest,
    networkChainId,
  };
}
