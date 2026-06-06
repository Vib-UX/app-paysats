import { prisma } from "@/lib/prisma";
import { createHash, randomBytes, randomUUID } from "node:crypto";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PENDING_TTL_MS = 15 * 60 * 1000; // 15 minutes
const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function opaque(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

// ---------------------------------------------------------------------------
// Dynamic client registration (RFC 7591)
// ---------------------------------------------------------------------------

export type RegisterClientInput = {
  clientName?: string;
  redirectUris: string[];
};

export async function registerClient(input: RegisterClientInput) {
  const clientId = `mcp_${randomUUID().replace(/-/g, "")}`;
  await prisma.oAuthClient.create({
    data: {
      clientId,
      clientName: input.clientName ?? null,
      redirectUris: input.redirectUris,
    },
  });
  return { clientId };
}

export async function getClient(clientId: string) {
  return prisma.oAuthClient.findUnique({ where: { clientId } });
}

// ---------------------------------------------------------------------------
// Pending authorization (carries /authorize params to the browser and back)
// ---------------------------------------------------------------------------

export type PendingAuthInput = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string;
  clientState?: string;
};

export async function createPendingAuth(input: PendingAuthInput) {
  const handle = opaque(24);
  await prisma.oAuthPendingAuth.create({
    data: {
      handle,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      scope: input.scope ?? null,
      clientState: input.clientState ?? null,
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
  });
  return { handle };
}

export async function getPendingAuth(handle: string) {
  const row = await prisma.oAuthPendingAuth.findUnique({ where: { handle } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

// ---------------------------------------------------------------------------
// Authorization codes (PKCE)
// ---------------------------------------------------------------------------

/** Mint an auth code after the user authenticated in the browser. */
export async function issueAuthCode(opts: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope?: string | null;
  privyUserId: string;
}) {
  const code = opaque(32);
  await prisma.oAuthAuthCode.create({
    data: {
      code,
      clientId: opts.clientId,
      redirectUri: opts.redirectUri,
      codeChallenge: opts.codeChallenge,
      codeChallengeMethod: opts.codeChallengeMethod,
      scope: opts.scope ?? null,
      privyUserId: opts.privyUserId,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });
  return { code };
}

function verifyPkce(
  method: string,
  challenge: string,
  verifier: string,
): boolean {
  if (method === "plain") return challenge === verifier;
  if (method === "S256") {
    const hash = createHash("sha256").update(verifier).digest("base64url");
    return hash === challenge;
  }
  return false;
}

export type RedeemResult =
  | { ok: true; privyUserId: string; scope: string | null; clientId: string }
  | { ok: false; error: string };

/** Exchange an auth code (+ PKCE verifier) for a Privy-user-bound result. */
export async function redeemAuthCode(opts: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<RedeemResult> {
  const row = await prisma.oAuthAuthCode.findUnique({
    where: { code: opts.code },
  });
  if (!row) return { ok: false, error: "invalid_grant" };
  if (row.consumedAt) return { ok: false, error: "invalid_grant" };
  if (row.expiresAt.getTime() < Date.now())
    return { ok: false, error: "invalid_grant" };
  if (row.clientId !== opts.clientId) return { ok: false, error: "invalid_grant" };
  if (row.redirectUri !== opts.redirectUri)
    return { ok: false, error: "invalid_grant" };
  if (!verifyPkce(row.codeChallengeMethod, row.codeChallenge, opts.codeVerifier))
    return { ok: false, error: "invalid_grant" };

  await prisma.oAuthAuthCode.update({
    where: { code: opts.code },
    data: { consumedAt: new Date() },
  });

  return {
    ok: true,
    privyUserId: row.privyUserId,
    scope: row.scope,
    clientId: row.clientId,
  };
}

// ---------------------------------------------------------------------------
// Access tokens (opaque)
// ---------------------------------------------------------------------------

export async function issueAccessToken(opts: {
  clientId: string;
  privyUserId: string;
  scope?: string | null;
}) {
  const token = opaque(32);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  await prisma.oAuthAccessToken.create({
    data: {
      token,
      clientId: opts.clientId,
      privyUserId: opts.privyUserId,
      scope: opts.scope ?? null,
      expiresAt,
    },
  });
  return { token, expiresInSec: Math.floor(ACCESS_TOKEN_TTL_MS / 1000) };
}

export async function verifyAccessToken(token: string) {
  const row = await prisma.oAuthAccessToken.findUnique({ where: { token } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}
