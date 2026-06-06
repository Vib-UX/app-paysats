import { registerClient } from "@/services/oauth/store";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

/** Dynamic Client Registration (RFC 7591) — public PKCE clients only. */
export async function POST(req: NextRequest) {
  let body: { client_name?: string; redirect_uris?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata" },
      { status: 400, headers: CORS },
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u) => typeof u === "string" && u.length > 0)
    : [];
  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri" },
      { status: 400, headers: CORS },
    );
  }

  const { clientId } = await registerClient({
    clientName: body.client_name,
    redirectUris,
  });

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: body.client_name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    { status: 201, headers: CORS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
