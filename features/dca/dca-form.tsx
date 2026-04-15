"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  IDRX_DECIMALS,
  INTERVAL_PRESETS,
} from "@/lib/contracts/arka-dca";
import { useCreateDcaOrder } from "@/hooks/use-dca-contract";
import { useCallback, useState } from "react";

type Props = {
  onCreated: () => void;
};

export function DcaForm({ onCreated }: Props) {
  const { create, busy, error: txError, txHash } = useCreateDcaOrder();

  const [amountIdr, setAmountIdr] = useState("");
  const [intervalIdx, setIntervalIdx] = useState(0);
  const [totalSwaps, setTotalSwaps] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);

    const raw = amountIdr.replace(/\./g, "").replace(/,/g, "").trim();
    const idrAmount = Number(raw);
    if (!raw || Number.isNaN(idrAmount) || idrAmount < 1) {
      setError("Masukkan nominal per swap (min. Rp 1)");
      return;
    }

    const swapsRaw = totalSwaps.trim();
    const swapsNum = swapsRaw === "" ? 0 : Number(swapsRaw);
    if (Number.isNaN(swapsNum) || swapsNum < 0 || swapsNum % 1 !== 0) {
      setError("Jumlah swap harus angka bulat (0 = tanpa batas)");
      return;
    }

    const amountPerSwap = BigInt(idrAmount) * BigInt(10 ** IDRX_DECIMALS);
    const interval = BigInt(INTERVAL_PRESETS[intervalIdx].seconds);

    const hash = await create({
      amountPerSwap,
      interval,
      totalSwaps: BigInt(swapsNum),
    });

    if (hash) {
      onCreated();
    }
  }, [amountIdr, intervalIdx, totalSwaps, create, onCreated]);

  if (txHash) {
    return (
      <Card className="space-y-3 border-green-300/50 bg-green-50/30">
        <p className="text-sm font-medium text-arka-text">
          Order DCA berhasil dibuat!
        </p>
        <p className="text-xs text-arka-text-muted">
          Chainlink Automation akan mengeksekusi swap secara otomatis sesuai
          jadwal. Tidak perlu aksi tambahan.
        </p>
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-arka-accent hover:underline"
        >
          Lihat di Basescan
        </a>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="dca-amount">Nominal per swap (IDR)</Label>
          <Input
            id="dca-amount"
            inputMode="numeric"
            placeholder="Contoh: 50000"
            value={amountIdr}
            onChange={(e) => setAmountIdr(e.target.value)}
          />
          <p className="mt-1 text-xs text-arka-text-muted">
            Jumlah IDRX yang di-swap ke cbBTC setiap eksekusi.
          </p>
        </div>

        <div>
          <Label>Frekuensi</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERVAL_PRESETS.map((p, i) => (
              <button
                key={p.seconds}
                type="button"
                onClick={() => setIntervalIdx(i)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  intervalIdx === i
                    ? "bg-arka-accent text-white"
                    : "bg-arka-surface-muted text-arka-text hover:bg-arka-border/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="dca-swaps">Jumlah eksekusi</Label>
          <Input
            id="dca-swaps"
            inputMode="numeric"
            placeholder="0 = tanpa batas"
            value={totalSwaps}
            onChange={(e) => setTotalSwaps(e.target.value)}
          />
          <p className="mt-1 text-xs text-arka-text-muted">
            Kosongkan atau isi 0 untuk DCA tanpa batas (bisa dibatalkan kapan
            saja).
          </p>
        </div>
      </Card>

      {(error || txError) && (
        <p className="text-sm text-arka-danger" role="alert">
          {error || txError}
        </p>
      )}

      <Card className="border-arka-border/60 bg-arka-surface-muted/40">
        <p className="text-xs leading-relaxed text-arka-text-muted">
          Satu konfirmasi: approve IDRX + buat order DCA dalam satu transaksi.
          Setelah selesai, Chainlink Automation mengeksekusi swap otomatis.
        </p>
      </Card>

      <Button onClick={submit} disabled={busy}>
        {busy ? "Mengirim transaksi…" : "Mulai DCA"}
      </Button>
    </div>
  );
}
