"use client";

import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";

export function SavingsClient() {
  return (
    <Screen
      title="Tabungan"
      subtitle="Kelola tujuan tabungan dan alokasi BTC kamu. Data sungguhan akan terhubung ke dompet Privy di rilis berikutnya."
    >
      <Card className="border-dashed">
        <p className="text-sm leading-relaxed text-arka-text-muted">
          Belum ada tabungan yang disimpan. Mulai dari Beranda dengan deposit
          IDRX, lalu atur alokasi per tujuan ketika fitur ini siap.
        </p>
      </Card>
    </Screen>
  );
}
