import {
  getPublicOrigin,
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

/**
 * RFC 9728 protected-resource metadata. Points MCP clients (Claude) at our
 * authorization server so they can begin the OAuth flow.
 */
export function GET(req: Request): Response {
  const origin = getPublicOrigin(req);
  return protectedResourceHandler({ authServerUrls: [origin] })(req);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
