import type { MintTransaction } from "@/types/transaction";
import type { IdrxHistoryRecord } from "./types";

export function normalizeMintRecord(r: IdrxHistoryRecord): MintTransaction {
  return {
    id: String(r.id),
    paymentAmount: r.paymentAmount,
    toBeMinted: String(r.toBeMinted),
    destinationWalletAddress: r.destinationWalletAddress,
    paymentStatus: r.paymentStatus,
    adminMintStatus: r.adminMintStatus,
    userMintStatus: r.userMintStatus,
    reference: r.reference,
    merchantOrderId: r.merchantOrderId,
    createdAt: r.createdAt,
    txHash: r.txHash ?? null,
    expiryTimestamp: r.expiryTimestamp ?? null,
  };
}
