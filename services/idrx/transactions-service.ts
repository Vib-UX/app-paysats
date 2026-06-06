import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/services/errors";
import { idrxUserTransactionHistory } from "@/services/idrx/client";
import { normalizeMintRecord } from "@/services/idrx/normalize";
import { deriveMintSettlement } from "@/services/idrx/settlement";
import type { MintTransaction } from "@/types/transaction";
import type { User } from "@privy-io/server-auth";

export type ListMintQuery = {
  page?: number;
  take?: number;
  merchantOrderId?: string;
  reference?: string;
  paymentStatus?: string;
  userMintStatus?: string;
  orderByDate?: "ASC" | "DESC";
};

export type ListMintResult = {
  transactions: MintTransaction[];
  metadata?: unknown;
};

export async function listMintTransactions(
  privyUser: User,
  query: ListMintQuery = {},
): Promise<ListMintResult> {
  const row = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (!row?.idrxApiKeyEnc || !row.idrxApiSecretEnc) {
    throw new ServiceError(403, "Onboarding IDRX belum selesai");
  }

  const page = Math.max(1, Number(query.page || 1) || 1);
  const take = Math.min(50, Math.max(1, Number(query.take || 20) || 20));

  const apiKey = decryptSecret(row.idrxApiKeyEnc);
  const apiSecret = decryptSecret(row.idrxApiSecretEnc);

  let hist;
  try {
    hist = await idrxUserTransactionHistory(apiKey, apiSecret, {
      transactionType: "MINT",
      page,
      take,
      merchantOrderId: query.merchantOrderId,
      reference: query.reference,
      paymentStatus: query.paymentStatus,
      userMintStatus: query.userMintStatus,
      orderByDate: query.orderByDate,
    });
  } catch (e) {
    console.error(e);
    throw new ServiceError(502, "Gagal memuat riwayat");
  }

  if (hist.statusCode !== 200 || !hist.records) {
    // Soft failure: empty list (matches existing route behaviour).
    return { transactions: [], metadata: hist.metadata };
  }

  const transactions = hist.records.map((r) => {
    const t = normalizeMintRecord(r);
    return { ...t, settlement: deriveMintSettlement(t) };
  });

  return { transactions, metadata: hist.metadata };
}

/** Resolve settlement for a single mint by reference or merchantOrderId. */
export async function getMintStatus(
  privyUser: User,
  selector: { reference?: string; merchantOrderId?: string },
): Promise<MintTransaction | null> {
  if (!selector.reference && !selector.merchantOrderId) {
    throw new ServiceError(400, "reference atau merchantOrderId wajib diisi");
  }
  const { transactions } = await listMintTransactions(privyUser, {
    reference: selector.reference,
    merchantOrderId: selector.merchantOrderId,
    take: 5,
  });
  return transactions[0] ?? null;
}
