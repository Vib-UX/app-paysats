import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  idrxAddBankAccount,
  idrxListBankAccounts,
  idrxListBankMethods,
} from "@/services/idrx/bank-accounts";
import {
  classifyMethod,
  lastFour,
  validateDestinationNumber,
  type DestinationKind,
} from "@/services/idrx/payout-methods";
import type { IdrxBankAccountRecord } from "@/services/idrx/types";
import { loadUserIdrxContext } from "@/services/idrx/user-credentials";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import type { PayoutDestination } from "@prisma/client";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type LocalDestination = Omit<PayoutDestination, "bankAccountNumberEnc">;

function toPublic(d: PayoutDestination): LocalDestination & {
  kind: DestinationKind;
} {
  const { bankAccountNumberEnc: _ignored, ...rest } = d;
  void _ignored;
  return { ...rest, kind: d.kind as DestinationKind };
}

/**
 * GET /api/idrx/destinations
 *
 * Returns the caller's payout destinations (banks + e-wallets), reconciled
 * between IDRX (source of truth) and our local cache. Destinations deleted
 * on IDRX are cleaned up locally; new destinations from IDRX get mirrored.
 */
export async function GET(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await loadUserIdrxContext(privyUser);
  if (!ctx) {
    return NextResponse.json(
      { error: "Selesaikan onboarding terlebih dahulu" },
      { status: 403 },
    );
  }

  let idrxRes;
  try {
    idrxRes = await idrxListBankAccounts(ctx.apiKey, ctx.apiSecret);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gagal mengambil tujuan payout dari IDRX" },
      { status: 502 },
    );
  }

  if (idrxRes.statusCode !== 200) {
    return NextResponse.json(
      { error: idrxRes.message || "Gagal mengambil tujuan payout" },
      { status: 502 },
    );
  }

  const remote = (idrxRes.data ?? []).filter((r) => !r.deleted);

  const local = await prisma.payoutDestination.findMany({
    where: { userId: ctx.userRow.id },
  });
  const localByIdrxId = new Map(local.map((d) => [d.idrxId, d]));
  const remoteIds = new Set(remote.map((r) => r.id));

  // Drop local rows that are no longer on IDRX
  const staleIds = local
    .filter((d) => !remoteIds.has(d.idrxId))
    .map((d) => d.id);
  if (staleIds.length > 0) {
    await prisma.payoutDestination.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  // Upsert fresh IDRX rows into local cache
  const upserted: PayoutDestination[] = [];
  for (const r of remote) {
    const kind = classifyMethod(r.bankCode, r.bankName);
    const depositAddr = r.DepositWalletAddress?.walletAddress ?? "";
    const existing = localByIdrxId.get(r.id);
    if (existing) {
      // Refresh mutable fields only
      const updated = await prisma.payoutDestination.update({
        where: { id: existing.id },
        data: {
          kind,
          bankCode: r.bankCode,
          bankName: r.bankName,
          bankAccountName: r.bankAccountName,
          bankAccountNumberLast: lastFour(r.bankAccountNumber),
          depositWalletAddress: depositAddr,
          maxAmountTransfer: r.maxAmountTransfer ?? null,
        },
      });
      upserted.push(updated);
    } else {
      const created = await prisma.payoutDestination.create({
        data: {
          userId: ctx.userRow.id,
          idrxId: r.id,
          kind,
          bankCode: r.bankCode,
          bankName: r.bankName,
          bankAccountName: r.bankAccountName,
          bankAccountNumberEnc: encryptSecret(r.bankAccountNumber),
          bankAccountNumberLast: lastFour(r.bankAccountNumber),
          depositWalletAddress: depositAddr,
          maxAmountTransfer: r.maxAmountTransfer ?? null,
          isDefault: upserted.length === 0 && local.length === 0,
        },
      });
      upserted.push(created);
    }
  }

  // Ensure exactly one default if we have any destinations
  if (upserted.length > 0) {
    const hasDefault = upserted.some((d) => d.isDefault);
    if (!hasDefault) {
      await prisma.payoutDestination.update({
        where: { id: upserted[0].id },
        data: { isDefault: true },
      });
      upserted[0] = { ...upserted[0], isDefault: true };
    }
  }

  return NextResponse.json({
    destinations: upserted.map(toPublic),
  });
}

/**
 * POST /api/idrx/destinations
 * Body: { kind: 'bank' | 'ewallet', bankCode: string, bankAccountNumber: string }
 */
export async function POST(request: NextRequest) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await loadUserIdrxContext(privyUser);
  if (!ctx) {
    return NextResponse.json(
      { error: "Selesaikan onboarding terlebih dahulu" },
      { status: 403 },
    );
  }

  let body: { kind?: string; bankCode?: string; bankAccountNumber?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const kind: DestinationKind =
    body.kind === "ewallet" ? "ewallet" : "bank";
  const bankCode = (body.bankCode ?? "").trim();
  const raw = body.bankAccountNumber ?? "";

  if (!bankCode) {
    return NextResponse.json({ error: "bankCode wajib" }, { status: 400 });
  }

  const validated = validateDestinationNumber(kind, raw);
  if (!validated.ok) {
    return NextResponse.json(
      { error: "bankAccountNumber tidak valid", reason: validated.reason },
      { status: 400 },
    );
  }

  // Cross-check that bankCode is in the IDRX-supported catalogue and that its
  // classification matches the requested kind.
  let catalogue;
  try {
    catalogue = await idrxListBankMethods(ctx.apiKey, ctx.apiSecret);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gagal memvalidasi kode bank/e-wallet" },
      { status: 502 },
    );
  }
  const method = catalogue.data?.find((m) => m.bankCode === bankCode);
  if (!method) {
    return NextResponse.json(
      { error: "bankCode tidak dikenal di IDRX" },
      { status: 400 },
    );
  }
  if (classifyMethod(method.bankCode, method.bankName) !== kind) {
    return NextResponse.json(
      { error: "Jenis tidak cocok — bank/e-wallet salah pilih" },
      { status: 400 },
    );
  }

  let idrxRes;
  try {
    idrxRes = await idrxAddBankAccount(ctx.apiKey, ctx.apiSecret, {
      bankCode,
      bankAccountNumber: validated.normalized,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gagal mendaftarkan tujuan payout di IDRX" },
      { status: 502 },
    );
  }

  if (
    (idrxRes.statusCode !== 200 && idrxRes.statusCode !== 201) ||
    !idrxRes.data
  ) {
    return NextResponse.json(
      {
        error: idrxRes.message || "IDRX menolak pendaftaran tujuan",
      },
      { status: 400 },
    );
  }

  const r: IdrxBankAccountRecord = idrxRes.data;
  const depositAddr = r.DepositWalletAddress?.walletAddress ?? "";
  if (!depositAddr) {
    return NextResponse.json(
      { error: "IDRX tidak mengembalikan alamat deposit" },
      { status: 502 },
    );
  }

  // First destination wins isDefault.
  const existingCount = await prisma.payoutDestination.count({
    where: { userId: ctx.userRow.id },
  });

  const created = await prisma.payoutDestination.upsert({
    where: {
      userId_idrxId: { userId: ctx.userRow.id, idrxId: r.id },
    },
    create: {
      userId: ctx.userRow.id,
      idrxId: r.id,
      kind,
      bankCode: r.bankCode,
      bankName: r.bankName,
      bankAccountName: r.bankAccountName,
      bankAccountNumberEnc: encryptSecret(r.bankAccountNumber),
      bankAccountNumberLast: lastFour(r.bankAccountNumber),
      depositWalletAddress: depositAddr,
      maxAmountTransfer: r.maxAmountTransfer ?? null,
      isDefault: existingCount === 0,
    },
    update: {
      kind,
      bankCode: r.bankCode,
      bankName: r.bankName,
      bankAccountName: r.bankAccountName,
      bankAccountNumberLast: lastFour(r.bankAccountNumber),
      depositWalletAddress: depositAddr,
      maxAmountTransfer: r.maxAmountTransfer ?? null,
    },
  });

  return NextResponse.json(
    { destination: toPublic(created) },
    { status: 201 },
  );
}
