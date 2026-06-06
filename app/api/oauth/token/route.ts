import { issueAccessToken, redeemAuthCode } from "@/services/oauth/store";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return (await req.json()) as Record<string, string>;
    } catch {
      return {};
    }
  }
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text));
}

/** OAuth 2.1 token endpoint — authorization_code grant with PKCE. */
export async function POST(req: NextRequest) {
  const body = await parseBody(req);

  if (body.grant_type !== "authorization_code") {
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400, headers: CORS },
    );
  }

  const code = body.code;
  const clientId = body.client_id;
  const redirectUri = body.redirect_uri;
  const codeVerifier = body.code_verifier;

  if (!code || !clientId || !redirectUri || !codeVerifier) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: CORS },
    );
  }

  const result = await redeemAuthCode({
    code,
    clientId,
    redirectUri,
    codeVerifier,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: CORS });
  }

  const { token, expiresInSec } = await issueAccessToken({
    clientId: result.clientId,
    privyUserId: result.privyUserId,
    scope: result.scope,
  });

  return NextResponse.json(
    {
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresInSec,
      scope: result.scope ?? undefined,
    },
    { headers: CORS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
