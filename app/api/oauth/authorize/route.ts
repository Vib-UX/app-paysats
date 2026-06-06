import { createPendingAuth, getClient } from "@/services/oauth/store";
import { requestDeviceCode } from "@/services/privy/device-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * OAuth 2.1 authorization endpoint (bridged onto Privy's device-authorization
 * grant). Validates the client + PKCE params, starts a Privy device
 * authorization, persists the device/user codes against a pending-auth handle,
 * then redirects the user's browser to the hosted Verification page
 * (app.paysats.exchange/verification) where they log in and approve agent
 * access. After approval the page returns to /api/oauth/device-complete.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);

  const responseType = searchParams.get("response_type");
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";
  const state = searchParams.get("state") || undefined;
  const scope = searchParams.get("scope") || undefined;

  if (responseType !== "code") {
    return errorRedirect(redirectUri, state, "unsupported_response_type");
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (codeChallengeMethod !== "S256") {
    return errorRedirect(redirectUri, state, "invalid_request");
  }

  const client = await getClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }

  // Start the Privy device authorization. The agent (this server) is the device.
  let device;
  try {
    device = await requestDeviceCode();
  } catch {
    return errorRedirect(redirectUri, state, "server_error");
  }

  const { handle } = await createPendingAuth({
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
    clientState: state,
    deviceCode: device.deviceCode,
    userCode: device.userCode,
  });

  // Prefer Privy's verification_uri_complete (it already carries user_code and
  // points at the dashboard-configured Verification URI). Fall back to env.
  const verifyUrl = buildVerificationUrl(device.verificationUriComplete, device.userCode);
  // Tell the verification page our handle + where to return after approval.
  verifyUrl.searchParams.set("handle", handle);
  verifyUrl.searchParams.set("complete", `${origin}/api/oauth/device-complete`);

  return NextResponse.redirect(verifyUrl);
}

function buildVerificationUrl(complete: string, userCode: string): URL {
  if (complete) {
    try {
      return new URL(complete);
    } catch {
      // fall through to env-based URL
    }
  }
  const base = process.env.VERIFICATION_BASE_URL || "https://app.paysats.exchange";
  const url = new URL("/verification", base);
  url.searchParams.set("user_code", userCode);
  return url;
}

function errorRedirect(
  redirectUri: string | null,
  state: string | undefined,
  error: string,
) {
  if (!redirectUri) {
    return NextResponse.json({ error }, { status: 400 });
  }
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
