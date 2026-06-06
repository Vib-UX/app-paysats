import { prisma } from "@/lib/prisma";
import { ensureIdrxOnboarding } from "@/services/idrx/onboarding-service";
import { getPendingAuth, issueAuthCode } from "@/services/oauth/store";
import { awaitDeviceToken } from "@/services/privy/device-auth";
import { saveDeviceSession } from "@/services/privy/device-session";
import {
  getEmbeddedWalletId,
  getPreferredEthereumAddress,
  getPrivyServerClient,
} from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Callback hit by the Verification page after the user approves agent access.
 * Polls Privy's token endpoint with the pending device code, stores the
 * per-user device access/refresh tokens, ensures IDRX onboarding, then mints an
 * OAuth 2.1 authorization code and redirects back to the MCP client (Claude).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle");
  const denied = searchParams.get("denied");

  if (!handle) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const pending = await getPendingAuth(handle);
  if (!pending || !pending.deviceCode) {
    return NextResponse.json({ error: "expired_or_invalid_handle" }, { status: 400 });
  }

  if (denied) {
    return clientRedirect(pending.redirectUri, pending.clientState, { error: "access_denied" });
  }

  // Poll Privy for the token now that the user has approved in the browser.
  const result = await awaitDeviceToken(pending.deviceCode, { intervalSec: 2, timeoutMs: 30_000 });
  if (result.status !== "ok") {
    console.error("[device-complete] token poll not ok:", result.status, "error" in result ? result.error : "");
    const error =
      result.status === "denied"
        ? "access_denied"
        : result.status === "expired"
          ? "expired_token"
          : "authorization_pending";
    return clientRedirect(pending.redirectUri, pending.clientState, { error });
  }

  // Resolve the user behind the device-grant access token. It may be a standard
  // Privy auth JWT (verifiable) or an OAuth access token — fall back to reading
  // the `sub` claim, since we obtained the token directly from Privy.
  const privy = getPrivyServerClient();
  let privyUser;
  try {
    const userId = await resolvePrivyUserId(result.tokens.accessToken);
    if (!userId) throw new Error("no_user_id_in_token");
    privyUser = await privy.getUser(userId);
  } catch (e) {
    console.error("[device-complete] user resolution failed:", e);
    return clientRedirect(pending.redirectUri, pending.clientState, {
      error: "server_error",
    });
  }

  const walletAddress = getPreferredEthereumAddress(privyUser) ?? null;
  const walletId = getEmbeddedWalletId(privyUser) ?? null;

  try {
    // Make sure a User row exists before we attach the device session.
    await prisma.user.upsert({
      where: { privyUserId: privyUser.id },
      create: {
        privyUserId: privyUser.id,
        ...(walletAddress ? { walletAddress } : {}),
      },
      update: {},
    });

    await saveDeviceSession({
      privyUserId: privyUser.id,
      tokens: result.tokens,
      walletId,
      walletAddress,
    });

    // IDRX onboarding (auto placeholder, no KYC) so deposits work right away.
    // Best-effort: never block the connection on onboarding.
    await ensureIdrxOnboarding(privyUser).catch((e) =>
      console.error("[device-complete] idrx onboarding (non-fatal):", e),
    );
  } catch (e) {
    console.error("[device-complete] persist failed:", e);
    return clientRedirect(pending.redirectUri, pending.clientState, {
      error: "server_error",
    });
  }

  const { code } = await issueAuthCode({
    clientId: pending.clientId,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    codeChallengeMethod: pending.codeChallengeMethod,
    scope: pending.scope,
    privyUserId: privyUser.id,
  });

  return clientRedirect(pending.redirectUri, pending.clientState, { code });
}

/**
 * Resolve the Privy user DID from a device-grant access token. Tries strict
 * verification first; if that fails (the device-grant token is an OAuth access
 * token, not the identity JWT verifyAuthToken expects), decode the `sub` claim.
 * Safe because we obtained the token directly from Privy's token endpoint.
 */
async function resolvePrivyUserId(accessToken: string): Promise<string | null> {
  try {
    const claims = await getPrivyServerClient().verifyAuthToken(accessToken);
    if (claims?.userId) return claims.userId;
  } catch {
    // fall through to decoding
  }
  const sub = decodeJwtClaim(accessToken, "sub");
  if (sub) {
    console.error("[device-complete] resolved user via decoded sub:", sub);
    return sub.startsWith("did:privy:") ? sub : `did:privy:${sub}`;
  }
  return null;
}

function decodeJwtClaim(token: string, claim: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const v = payload[claim];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

function clientRedirect(
  redirectUri: string,
  state: string | null,
  params: { code?: string; error?: string },
) {
  const url = new URL(redirectUri);
  if (params.code) url.searchParams.set("code", params.code);
  if (params.error) url.searchParams.set("error", params.error);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
