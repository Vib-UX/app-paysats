import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { ServiceError } from "@/services/errors";
import { refreshDeviceToken, type TokenSet } from "@/services/privy/device-auth";

const NEAR_EXPIRY_MS = 60_000;

/**
 * Persist the per-user device-grant tokens (access + refresh, both encrypted)
 * after the user approves agent access. Records the embedded wallet id + link
 * timestamp so the signing path knows the user has connected.
 */
export async function saveDeviceSession(opts: {
  privyUserId: string;
  tokens: TokenSet;
  walletId?: string | null;
  walletAddress?: string | null;
}): Promise<void> {
  await prisma.user.update({
    where: { privyUserId: opts.privyUserId },
    data: {
      privyDeviceAccessTokenEnc: encryptSecret(opts.tokens.accessToken),
      privyDeviceAccessTokenExp: new Date(opts.tokens.expiresAt),
      privyDeviceRefreshTokenEnc: opts.tokens.refreshToken
        ? encryptSecret(opts.tokens.refreshToken)
        : null,
      ...(opts.walletAddress ? { walletAddress: opts.walletAddress } : {}),
      ...(opts.walletId ? { agentWalletId: opts.walletId } : {}),
      agentLinkedAt: new Date(),
    },
  });
}

type DeviceContext = {
  accessToken: string;
  walletId: string;
};

/**
 * Load a valid device access token for the user, refreshing it via the stored
 * refresh token when it is expired or near expiry. Throws a clear ServiceError
 * if the user has not connected the agent yet.
 */
export async function requireDeviceContext(privyUserId: string): Promise<DeviceContext> {
  const row = await prisma.user.findUnique({ where: { privyUserId } });
  if (!row?.agentLinkedAt || !row.privyDeviceAccessTokenEnc || !row.agentWalletId) {
    throw new ServiceError(
      403,
      "Hubungkan agent terlebih dahulu (buka tautan verifikasi untuk memberi izin).",
    );
  }

  const exp = row.privyDeviceAccessTokenExp?.getTime() ?? 0;
  let accessToken = decryptSecret(row.privyDeviceAccessTokenEnc);

  if (exp < Date.now() + NEAR_EXPIRY_MS) {
    accessToken = await refreshAndStore(privyUserId, row.privyDeviceRefreshTokenEnc);
  }

  return { accessToken, walletId: row.agentWalletId };
}

/** Force a refresh (e.g. after a 401 from a wallet RPC) and persist the result. */
export async function refreshDeviceContext(privyUserId: string): Promise<DeviceContext> {
  const row = await prisma.user.findUnique({ where: { privyUserId } });
  if (!row?.agentWalletId) {
    throw new ServiceError(403, "Agent belum terhubung.");
  }
  const accessToken = await refreshAndStore(privyUserId, row.privyDeviceRefreshTokenEnc);
  return { accessToken, walletId: row.agentWalletId };
}

async function refreshAndStore(
  privyUserId: string,
  refreshTokenEnc: string | null,
): Promise<string> {
  if (!refreshTokenEnc) {
    throw new ServiceError(
      401,
      "Sesi agent kedaluwarsa. Hubungkan ulang agent (verifikasi).",
    );
  }
  let tokens: TokenSet;
  try {
    tokens = await refreshDeviceToken(decryptSecret(refreshTokenEnc));
  } catch {
    throw new ServiceError(
      401,
      "Sesi agent kedaluwarsa atau dicabut. Hubungkan ulang agent (verifikasi).",
    );
  }
  await prisma.user.update({
    where: { privyUserId },
    data: {
      privyDeviceAccessTokenEnc: encryptSecret(tokens.accessToken),
      privyDeviceAccessTokenExp: new Date(tokens.expiresAt),
      privyDeviceRefreshTokenEnc: tokens.refreshToken
        ? encryptSecret(tokens.refreshToken)
        : null,
    },
  });
  return tokens.accessToken;
}
