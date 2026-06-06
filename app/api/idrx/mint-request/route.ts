import { errorMessage, ServiceError } from "@/services/errors";
import { createIdrMintRequest } from "@/services/idrx/mint-service";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Body = {
  toBeMinted: string;
  expiryPeriod: number;
  networkChainId?: string;
  requestType?: string;
  destinationWalletAddress?: string;
};

export async function POST(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  try {
    const result = await createIdrMintRequest(privyUser, {
      toBeMinted: body.toBeMinted,
      expiryPeriod: body.expiryPeriod,
      networkChainId: body.networkChainId,
      requestType: body.requestType,
      destinationWalletAddress: body.destinationWalletAddress,
    });
    return NextResponse.json({
      paymentUrl: result.paymentUrl,
      amount: result.amount,
      reference: result.reference,
      merchantOrderId: result.merchantOrderId,
      statusMessage: result.statusMessage,
      statusCode: result.statusCode,
    });
  } catch (e) {
    const status = e instanceof ServiceError ? e.status : 500;
    return NextResponse.json(
      { error: errorMessage(e, "Gagal membuat permintaan mint") },
      { status },
    );
  }
}
