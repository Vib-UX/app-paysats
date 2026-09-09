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
    // English fallback when t is omitted (never prefer Indonesian).
    if (s.includes("WAITING_FOR_PAYMENT")) return "Waiting for payment";
    if (s.includes("EXPIRED")) return "Expired";
    if (s.includes("FAIL")) return "Failed";
    if (s.includes("PAID") || s.includes("SUCCESS")) return "Paid";
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
    if (a.includes("MINTED") || a.includes("COMPLETED")) return "Minted";
    if (a.includes("REQUESTED")) return "Processing";
    if (a.includes("APPROVED")) return "Approved";
    if (a.includes("FAIL")) return "Mint failed";
    if (user.toUpperCase().includes("NOT_AVAILABLE")) return "Waiting";
  }
  return admin.replaceAll("_", " ").toLowerCase();
}
