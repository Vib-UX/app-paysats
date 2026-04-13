import type { MintTransaction } from "@/types/transaction";

/** Mengacu ke docs IDRX: paymentStatus + userMintStatus / adminMintStatus */
export type MintSettlement = {
  paymentComplete: boolean;
  mintComplete: boolean;
  /** Ringkasan untuk UI */
  summary: string;
};

export function deriveMintSettlement(tx: MintTransaction): MintSettlement {
  const ps = tx.paymentStatus?.toUpperCase() ?? "";
  const um = tx.userMintStatus?.toUpperCase() ?? "";
  const am = tx.adminMintStatus?.toUpperCase() ?? "";

  const paymentComplete = ps === "PAID" || ps.includes("SUCCESS");
  const mintComplete =
    (um === "MINTED" || am === "MINTED") &&
    !um.includes("FAIL") &&
    !am.includes("FAIL");

  let summary: string;
  if (mintComplete && paymentComplete) {
    summary = "Pembayaran & mint selesai";
  } else if (paymentComplete && !mintComplete) {
    summary = "Dibayar — mint sedang diproses";
  } else if (ps.includes("WAITING")) {
    summary = "Menunggu pembayaran";
  } else if (ps.includes("EXPIRED")) {
    summary = "Pembayaran kedaluwarsa";
  } else if (um.includes("FAIL") || am.includes("FAIL")) {
    summary = "Mint gagal";
  } else {
    summary = "Dalam proses";
  }

  return { paymentComplete, mintComplete, summary };
}
