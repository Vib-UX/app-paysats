import type { User } from "@privy-io/server-auth";

export function displayNameFromPrivy(user: User): string | undefined {
  if (user.google?.name) return user.google.name;
  if (user.email?.address) return user.email.address.split("@")[0];
  return undefined;
}

export function emailFromPrivy(user: User): string | undefined {
  return user.email?.address ?? user.google?.email;
}
