import { prisma } from "@/lib/prisma";
import { idrxDeleteBankAccount } from "@/services/idrx/bank-accounts";
import { loadUserIdrxContext } from "@/services/idrx/user-credentials";
import { getPrivyUserFromRequest } from "@/services/privy/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/idrx/destinations/:id
 *
 * Removes the destination from IDRX first; only on success do we delete the
 * local mirror. If a RedeemRequest still references this destination, the
 * local delete will be blocked — we return 409 in that case.
 */
export async function DELETE(request: NextRequest, ctx: Params) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userCtx = await loadUserIdrxContext(privyUser);
  if (!userCtx) {
    return NextResponse.json(
      { error: "Selesaikan onboarding terlebih dahulu" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const existing = await prisma.payoutDestination.findFirst({
    where: { id, userId: userCtx.userRow.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }

  let idrxRes;
  try {
    idrxRes = await idrxDeleteBankAccount(
      userCtx.apiKey,
      userCtx.apiSecret,
      existing.idrxId,
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gagal menghapus di IDRX" },
      { status: 502 },
    );
  }

  if (idrxRes.statusCode !== 200) {
    return NextResponse.json(
      { error: idrxRes.message || "IDRX menolak penghapusan" },
      { status: 400 },
    );
  }

  try {
    await prisma.payoutDestination.delete({ where: { id: existing.id } });
  } catch (e) {
    // Likely a foreign key violation from RedeemRequest referencing this row.
    console.error(e);
    return NextResponse.json(
      {
        error:
          "Tidak bisa menghapus — ada riwayat redeem yang terkait. Coba lagi setelah redeem selesai.",
      },
      { status: 409 },
    );
  }

  // If we deleted the default, promote another to default (first remaining).
  if (existing.isDefault) {
    const next = await prisma.payoutDestination.findFirst({
      where: { userId: userCtx.userRow.id },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.payoutDestination.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/idrx/destinations/:id
 * Body: { isDefault: true }  — promote this destination to default.
 */
export async function PATCH(request: NextRequest, ctx: Params) {
  const privyUser = await getPrivyUserFromRequest(request);
  if (!privyUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userCtx = await loadUserIdrxContext(privyUser);
  if (!userCtx) {
    return NextResponse.json(
      { error: "Selesaikan onboarding terlebih dahulu" },
      { status: 403 },
    );
  }

  let body: { isDefault?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  if (body.isDefault !== true) {
    return NextResponse.json(
      { error: "Hanya isDefault=true yang didukung" },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  const existing = await prisma.payoutDestination.findFirst({
    where: { id, userId: userCtx.userRow.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.payoutDestination.updateMany({
      where: { userId: userCtx.userRow.id, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.payoutDestination.update({
      where: { id: existing.id },
      data: { isDefault: true },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
