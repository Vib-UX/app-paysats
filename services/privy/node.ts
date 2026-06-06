import { PrivyClient as PrivyNodeClient } from "@privy-io/node";

let nodeClient: PrivyNodeClient | null = null;

/**
 * Server-side Privy client (@privy-io/node) used to execute wallet actions on
 * behalf of users via a session signer. Distinct from the @privy-io/server-auth
 * client (services/privy/server.ts) which only verifies user tokens.
 */
export function getPrivyNodeClient(): PrivyNodeClient {
  if (nodeClient) return nodeClient;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }
  nodeClient = new PrivyNodeClient({ appId, appSecret });
  return nodeClient;
}

/**
 * The session-signer authorization private key (base64 PKCS8, no PEM headers)
 * that our backend uses to authorize wallet actions. Configured in the Privy
 * Dashboard as a signer; its public key is registered there and the private
 * key lives only here.
 */
export function getAgentAuthorizationKey(): string | undefined {
  return process.env.PRIVY_AUTHORIZATION_KEY?.trim() || undefined;
}
