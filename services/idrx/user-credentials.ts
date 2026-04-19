import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import type { User as PrivyUser } from "@privy-io/server-auth";

export type UserIdrxContext = {
  /** Local User row */
  userRow: NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
  apiKey: string;
  apiSecret: string;
};

/**
 * Load the current user's row + per-user IDRX API credentials (decrypted).
 * Returns `null` if onboarding isn't complete — callers should respond 403.
 */
export async function loadUserIdrxContext(
  privyUser: PrivyUser,
): Promise<UserIdrxContext | null> {
  const userRow = await prisma.user.findUnique({
    where: { privyUserId: privyUser.id },
  });
  if (
    !userRow?.onboardingCompletedAt ||
    !userRow.idrxApiKeyEnc ||
    !userRow.idrxApiSecretEnc
  ) {
    return null;
  }

  return {
    userRow,
    apiKey: decryptSecret(userRow.idrxApiKeyEnc),
    apiSecret: decryptSecret(userRow.idrxApiSecretEnc),
  };
}
