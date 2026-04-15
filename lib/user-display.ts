import type { User } from "@privy-io/server-auth";

export function displayNameFromPrivy(user: User): string | undefined {
  if (user.google?.name) return user.google.name;
  if (user.email?.address) return user.email.address.split("@")[0];
  return undefined;
}

export function emailFromPrivy(user: User): string | undefined {
  return user.email?.address ?? user.google?.email;
}

const IDRX_FULLNAME_MAX = 120;

/**
 * Nama untuk field `fullname` IDRX onboarding (org API).
 * Prioritas: Google name → nama dari linked google_oauth → bagian lokal email (uppercase).
 */
export function fullNameForIdrxOnboarding(user: User): string {
  const fromTop = user.google?.name?.trim();
  if (fromTop) return fromTop.slice(0, IDRX_FULLNAME_MAX);

  for (const a of user.linkedAccounts ?? []) {
    if (a.type === "google_oauth") {
      const n = a.name?.trim();
      if (n) return n.slice(0, IDRX_FULLNAME_MAX);
    }
  }

  const email = emailFromPrivy(user)?.trim();
  if (email) {
    const local = email.split("@")[0]?.replace(/[.+]/g, " ").trim();
    if (local) {
      return local.toUpperCase().slice(0, IDRX_FULLNAME_MAX);
    }
  }

  return "USER";
}
