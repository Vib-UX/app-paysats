import type { IdrxBankMethod } from "./types";

export type DestinationKind = "bank" | "ewallet";

/**
 * Known IDRX `bankCode`s that represent e-wallets rather than conventional
 * banks. Keep this list as the single source of truth; verify new codes by
 * inspecting live responses from `GET /api/transaction/method` before
 * shipping support for a new e-wallet provider.
 */
export const EWALLET_BANK_CODES: ReadonlySet<string> = new Set([
  "1011", // GoPay
  "1012", // OVO (tentative — verify in sandbox)
  "1013", // DANA (tentative)
  "1014", // ShopeePay (tentative)
  "1015", // LinkAja (tentative)
]);

/**
 * E-wallet provider name fragments used as a fallback when `bankCode` isn't in
 * the known set (IDRX occasionally rolls out new providers before we update
 * the code list).
 */
const EWALLET_NAME_FRAGMENTS = [
  "GOPAY",
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "SHOPEE PAY",
  "LINKAJA",
  "LINK AJA",
];

export function classifyMethod(
  bankCode: string,
  bankName: string,
): DestinationKind {
  if (EWALLET_BANK_CODES.has(bankCode.trim())) return "ewallet";

  const upper = (bankName ?? "").toUpperCase();
  for (const frag of EWALLET_NAME_FRAGMENTS) {
    if (upper.includes(frag)) return "ewallet";
  }
  return "bank";
}

export type ClassifiedMethod = IdrxBankMethod & { kind: DestinationKind };

export function classifyMethods(methods: IdrxBankMethod[]): ClassifiedMethod[] {
  return methods.map((m) => ({
    ...m,
    kind: classifyMethod(m.bankCode, m.bankName),
  }));
}

// ---------------------------------------------------------------------------
// Destination-number validation & formatting
// ---------------------------------------------------------------------------

export type ValidateResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

/**
 * Normalize & validate the raw value entered by the user.
 *
 * - `bank`: strip whitespace, digits-only, 6–20 digits.
 * - `ewallet`: strip whitespace / hyphens / leading `+`, digits-only, length
 *   ≥ 11 (e.g. 62 + 9-digit phone); we don't hard-restrict to a specific
 *   country code because IDRX may support multiple markets, but reject
 *   values that start with `0` (common mistake — Indonesian users tend to
 *   omit the country code).
 */
export function validateDestinationNumber(
  kind: DestinationKind,
  raw: string,
): ValidateResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  if (kind === "bank") {
    const cleaned = trimmed.replace(/\s+/g, "");
    if (!/^\d+$/.test(cleaned)) return { ok: false, reason: "digits_only" };
    if (cleaned.length < 6 || cleaned.length > 20) {
      return { ok: false, reason: "bank_length" };
    }
    return { ok: true, normalized: cleaned };
  }

  // e-wallet: phone number
  const cleaned = trimmed.replace(/[\s\-()]+/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(cleaned)) return { ok: false, reason: "digits_only" };
  if (cleaned.startsWith("0")) return { ok: false, reason: "needs_country_code" };
  if (cleaned.length < 11 || cleaned.length > 15) {
    return { ok: false, reason: "ewallet_length" };
  }
  return { ok: true, normalized: cleaned };
}

/** Mask all but the last 4 digits (for PII-safe display). */
export function maskAccountNumber(raw: string): string {
  const cleaned = (raw ?? "").replace(/\D/g, "");
  if (cleaned.length <= 4) return cleaned;
  return "•".repeat(Math.max(0, cleaned.length - 4)) + cleaned.slice(-4);
}

export function lastFour(raw: string): string {
  const cleaned = (raw ?? "").replace(/\D/g, "");
  return cleaned.slice(-4);
}

/** Present an e-wallet phone number like "62 812-3456-7890". */
export function formatEwalletPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  const cc = digits.slice(0, 2);
  const rest = digits.slice(2);
  // Group in 3-4-4 style, tolerant of shorter numbers.
  const groups: string[] = [];
  let i = 0;
  const sizes = [3, 4, 4, 4];
  for (const s of sizes) {
    if (i >= rest.length) break;
    groups.push(rest.slice(i, i + s));
    i += s;
  }
  if (i < rest.length) groups.push(rest.slice(i));
  return `${cc} ${groups.join("-")}`;
}
