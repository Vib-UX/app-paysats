import { PrivyClient, type User } from "@privy-io/server-auth";
import type { NextRequest } from "next/server";
import { isAddress } from "viem";

let client: PrivyClient | null = null;

export function getPrivyServerClient(): PrivyClient {
  if (client) return client;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }
  client = new PrivyClient(appId, appSecret);
  return client;
}

export function getEmbeddedEthereumAddress(user: User): string | undefined {
  const embedded = user.linkedAccounts?.find(
    (a) =>
      a.type === "wallet" &&
      a.walletClientType === "privy" &&
      a.chainType === "ethereum",
  );
  if (embedded && embedded.type === "wallet" && "address" in embedded) {
    return embedded.address;
  }
  if (
    user.wallet?.walletClientType === "privy" &&
    user.wallet.chainType === "ethereum"
  ) {
    return user.wallet.address;
  }
  return undefined;
}

/**
 * Alamat EVM untuk saldo on-chain — tidak hanya embedded Privy (Base Account, dll).
 */
export function getPreferredEthereumAddress(user: User): string | undefined {
  const emb = getEmbeddedEthereumAddress(user);
  if (emb) return emb;
  if (user.wallet?.address && user.wallet.chainType === "ethereum") {
    return user.wallet.address;
  }
  if (user.smartWallet?.address) return user.smartWallet.address;
  for (const a of user.linkedAccounts ?? []) {
    if (a.type === "wallet" && "address" in a && a.address) {
      if (a.chainType === "ethereum" || isAddress(a.address)) {
        return a.address;
      }
    }
    if (a.type === "smart_wallet" && "address" in a && a.address) {
      return a.address;
    }
  }
  return undefined;
}

export async function getPrivyUserFromRequest(request: NextRequest): Promise<User | null> {
  const privy = getPrivyServerClient();

  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const token = bearer.slice(7);
    try {
      const claims = await privy.verifyAuthToken(token);
      return await privy.getUser(claims.userId);
    } catch {
      return null;
    }
  }

  const idToken = request.cookies.get("privy-id-token")?.value;
  if (idToken) {
    try {
      return await privy.getUserFromIdToken(idToken);
    } catch {
      return null;
    }
  }

  return null;
}
