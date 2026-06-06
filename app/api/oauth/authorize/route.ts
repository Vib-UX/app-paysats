import { createPendingAuth, getClient } from "@/services/oauth/store";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * OAuth 2.1 authorization endpoint. Validates the client + PKCE params, stores a
 * pending-auth handle, then redirects the user's browser to the /connect page
 * where they log in with Privy and grant the agent session signer.
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

  const { handle } = await createPendingAuth({
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
    clientState: state,
  });

  const connectUrl = new URL("/connect", origin);
  connectUrl.searchParams.set("handle", handle);
  return NextResponse.redirect(connectUrl);
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
