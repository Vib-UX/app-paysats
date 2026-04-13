import { prisma } from "@/lib/prisma";
import { displayNameFromPrivy, emailFromPrivy } from "@/lib/user-display";
import {
  getEmbeddedEthereumAddress,
  getPrivyUserFromRequest,
} from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Body = { walletAddress?: string };

export async function POST(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    /* optional body */
  }

  const serverWallet = getEmbeddedEthereumAddress(privyUser);
  const email = emailFromPrivy(privyUser);
  const displayName = displayNameFromPrivy(privyUser);

  let walletAddress = serverWallet ?? null;
  if (body.walletAddress) {
    const clientAddr = body.walletAddress.toLowerCase();
    const linked = privyUser.linkedAccounts
      .filter((a) => a.type === "wallet")
      .map((a) => ("address" in a ? a.address.toLowerCase() : ""));
    if (
      serverWallet &&
      clientAddr === serverWallet.toLowerCase()
    ) {
      walletAddress = serverWallet;
    } else if (linked.includes(clientAddr)) {
      walletAddress = body.walletAddress;
    }
  }

  await prisma.user.upsert({
    where: { privyUserId: privyUser.id },
    create: {
      privyUserId: privyUser.id,
      email: email ?? undefined,
      displayName: displayName ?? undefined,
      walletAddress: walletAddress ?? undefined,
    },
    update: {
      email: email ?? undefined,
      displayName: displayName ?? undefined,
      ...(walletAddress ? { walletAddress } : {}),
    },
  });

  return NextResponse.json({ ok: true, walletAddress });
}
