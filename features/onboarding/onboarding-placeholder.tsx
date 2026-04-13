"use client";

import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import Link from "next/link";

/**
 * IDRX dihubungkan otomatis di Mint (email Privy + placeholder mitra).
 */
export function OnboardingPlaceholder() {
  return (
    <Screen
      title="IDRX"
      subtitle="Akun mitra dihubungkan otomatis saat kamu membuka Mint — memakai
          email dari Privy, tanpa unggah KYC di sini."
    >
      <Card className="space-y-4">
        <p className="text-sm leading-relaxed text-arka-text-muted">
          Buka halaman Mint untuk menyelesaikan penautan IDRX di latar belakang
          dan membuat permintaan IDRX.
        </p>
        <Link
          href="/mint"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-arka-accent px-4 text-sm font-medium text-white transition hover:bg-arka-accent-muted"
        >
          Ke Mint
        </Link>
      </Card>
    </Screen>
  );
}
