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

export function summarizePayment(status: string): string {
  const s = status.toUpperCase();
  if (s.includes("WAITING_FOR_PAYMENT")) return "Menunggu pembayaran";
  if (s.includes("EXPIRED")) return "Kedaluwarsa";
  if (s.includes("FAIL")) return "Gagal";
  if (s.includes("PAID") || s.includes("SUCCESS")) return "Dibayar";
  return status.replaceAll("_", " ").toLowerCase();
}

export function summarizeMint(admin: string, user: string): string {
  const a = admin.toUpperCase();
  if (a.includes("MINTED") || a.includes("COMPLETED")) return "Sudah di-mint";
  if (a.includes("REQUESTED")) return "Diproses";
  if (a.includes("APPROVED")) return "Disetujui";
  if (a.includes("FAIL")) return "Gagal mint";
  if (user.toUpperCase().includes("NOT_AVAILABLE")) return "Menunggu";
  return admin.replaceAll("_", " ").toLowerCase();
}
