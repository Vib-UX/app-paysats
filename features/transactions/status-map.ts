type ToneLocal = "neutral" | "info" | "success" | "warning" | "danger";

export function paymentTone(status: string): ToneLocal {
  const s = status.toUpperCase();
  if (s.includes("WAITING") || s.includes("PENDING")) return "warning";
  if (s.includes("PAID") || s.includes("SUCCESS") || s.includes("COMPLETE"))
    return "success";
  if (s.includes("EXPIRED") || s.includes("CANCEL") || s.includes("FAIL"))
    return "danger";
  return "info";
}

export function summarizePayment(
  status: string,
  t?: (key: string) => string,
): string {
  const s = status.toUpperCase();
  if (t) {
    if (s.includes("WAITING_FOR_PAYMENT")) return t("tx.status.waitingPayment");
    if (s.includes("EXPIRED")) return t("tx.status.expired");
    if (s.includes("FAIL")) return t("tx.status.failed");
    if (s.includes("PAID") || s.includes("SUCCESS")) return t("tx.status.paid");
  } else {
    if (s.includes("WAITING_FOR_PAYMENT")) return "Menunggu pembayaran";
    if (s.includes("EXPIRED")) return "Kedaluwarsa";
    if (s.includes("FAIL")) return "Gagal";
    if (s.includes("PAID") || s.includes("SUCCESS")) return "Dibayar";
  }
  return status.replaceAll("_", " ").toLowerCase();
}

export function summarizeMint(
  admin: string,
  user: string,
  t?: (key: string) => string,
): string {
  const a = admin.toUpperCase();
  if (t) {
    if (a.includes("MINTED") || a.includes("COMPLETED")) return t("tx.status.minted");
    if (a.includes("REQUESTED")) return t("tx.status.processing");
    if (a.includes("APPROVED")) return t("tx.status.approved");
    if (a.includes("FAIL")) return t("tx.status.mintFailed");
    if (user.toUpperCase().includes("NOT_AVAILABLE")) return t("tx.status.waiting");
  } else {
    if (a.includes("MINTED") || a.includes("COMPLETED")) return "Sudah di-mint";
    if (a.includes("REQUESTED")) return "Diproses";
    if (a.includes("APPROVED")) return "Disetujui";
    if (a.includes("FAIL")) return "Gagal mint";
    if (user.toUpperCase().includes("NOT_AVAILABLE")) return "Menunggu";
  }
  return admin.replaceAll("_", " ").toLowerCase();
}
