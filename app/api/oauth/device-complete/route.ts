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
    const error =
      result.status === "denied"
        ? "access_denied"
        : result.status === "expired"
          ? "expired_token"
          : "authorization_pending";
    return clientRedirect(pending.redirectUri, pending.clientState, { error });
  }

  // The access token is a Privy user access token — resolve the user from it.
  const privy = getPrivyServerClient();
  let privyUser;
  try {
    const claims = await privy.verifyAuthToken(result.tokens.accessToken);
    privyUser = await privy.getUser(claims.userId);
  } catch {
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

    // IDRX onboarding (auto placeholder, no KYC) so deposits work right away.
    await ensureIdrxOnboarding(privyUser).catch(() => undefined);

    await saveDeviceSession({
      privyUserId: privyUser.id,
      tokens: result.tokens,
      walletId,
      walletAddress,
    });
  } catch {
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
