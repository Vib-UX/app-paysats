import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/services/errors";
import { ensureIdrxOnboarding } from "@/services/idrx/onboarding-service";
import { getPendingAuth, issueAuthCode } from "@/services/oauth/store";
import { getAgentPolicyId, getAgentSignerId } from "@/services/privy/policy";
import {
  getEmbeddedWalletId,
  getPreferredEthereumAddress,
  getPrivyServerClient,
} from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Body = {
  handle: string;
  /** Privy access token from the logged-in browser session. */
  privyAccessToken: string;
  /** Embedded wallet id the session signer was granted on. */
  walletId?: string;
};

/**
 * Called by the /connect page after the user logs in with Privy and grants the
 * agent session signer. Verifies the Privy token, ensures IDRX onboarding,
 * records the agent grant, and mints an OAuth auth code, returning the redirect
 * URL back to the MCP client (Claude).
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.handle || !body.privyAccessToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const pending = await getPendingAuth(body.handle);
  if (!pending) {
    return NextResponse.json({ error: "expired_or_invalid_handle" }, { status: 400 });
  }

  // Verify the Privy session and load the user.
  const privy = getPrivyServerClient();
  let privyUser;
  try {
    const claims = await privy.verifyAuthToken(body.privyAccessToken);
    privyUser = await privy.getUser(claims.userId);
  } catch {
    return NextResponse.json({ error: "invalid_privy_token" }, { status: 401 });
  }

  try {
    // Ensure IDRX onboarding (auto placeholder, no KYC) and sync the wallet.
    await ensureIdrxOnboarding(privyUser);

    const walletAddress = getPreferredEthereumAddress(privyUser);
    const embeddedWalletId = getEmbeddedWalletId(privyUser) ?? body.walletId ?? null;
    await prisma.user.update({
      where: { privyUserId: privyUser.id },
      data: {
        ...(walletAddress ? { walletAddress } : {}),
        agentSignerId: getAgentSignerId() ?? null,
        agentPolicyId: getAgentPolicyId() ?? null,
        agentWalletId: embeddedWalletId,
        agentLinkedAt: new Date(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: errorMessage(e, "Gagal menyelesaikan onboarding") },
      { status: 500 },
    );
  }

  const { code } = await issueAuthCode({
    clientId: pending.clientId,
    redirectUri: pending.redirectUri,
    codeChallenge: pending.codeChallenge,
    codeChallengeMethod: pending.codeChallengeMethod,
    scope: pending.scope,
    privyUserId: privyUser.id,
  });

  const redirectUrl = new URL(pending.redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (pending.clientState) redirectUrl.searchParams.set("state", pending.clientState);

  return NextResponse.json({ redirectUrl: redirectUrl.toString() });
}
