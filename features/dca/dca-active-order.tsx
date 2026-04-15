"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CBBTC_DECIMALS,
  IDRX_DECIMALS,
  INTERVAL_PRESETS,
} from "@/lib/contracts/arka-dca";
import type { DcaExecution, DcaOrder } from "@/lib/contracts/arka-dca";
import { useCancelDcaOrder, useDcaExecutions } from "@/hooks/use-dca-contract";
import { useCallback, useState } from "react";

function formatIdrx(raw: bigint): string {
  const n = Number(raw) / 10 ** IDRX_DECIMALS;
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function formatSats(raw: bigint): string {
  return Number(raw).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function formatBtc(raw: bigint): string {
  const n = Number(raw) / 10 ** CBBTC_DECIMALS;
  return n.toLocaleString("id-ID", { maximumFractionDigits: 8, minimumFractionDigits: 2 });
}

function intervalLabel(seconds: bigint): string {
  const s = Number(seconds);
  const match = INTERVAL_PRESETS.find((p) => p.seconds === s);
  if (match) return match.label;
  if (s < 3600) return `${Math.round(s / 60)} menit`;
  if (s < 86_400) return `${Math.round(s / 3600)} jam`;
  return `${Math.round(s / 86_400)} hari`;
}

function nextExecution(order: DcaOrder): string {
  if (order.lastExecutedAt === BigInt(0)) return "Segera";
  const nextTs = Number(order.lastExecutedAt + order.interval);
  const now = Math.floor(Date.now() / 1000);
  const diff = nextTs - now;
  if (diff <= 0) return "Menunggu keeper…";
  if (diff < 3600) return `~${Math.ceil(diff / 60)} menit lagi`;
  if (diff < 86_400) return `~${Math.ceil(diff / 3600)} jam lagi`;
  return `~${Math.ceil(diff / 86_400)} hari lagi`;
}

function SwapHistoryRow({ exec }: { exec: DcaExecution }) {
  const txUrl = `https://basescan.org/tx/${exec.transactionHash}`;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-arka-border/30 py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-arka-text">
          {formatIdrx(exec.idrxSpent)} IDRX → {formatSats(exec.cbBTCReceived)} sats
        </p>
        <p className="text-[10px] text-arka-text-muted">
          {formatBtc(exec.cbBTCReceived)} cbBTC
        </p>
      </div>
      <a
        href={txUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded bg-arka-surface-muted px-2 py-1 text-[10px] font-medium text-arka-accent hover:underline"
      >
        Tx
      </a>
    </div>
  );
}

function SwapHistory() {
  const { executions, loading, error } = useDcaExecutions();

  if (loading) {
    return (
      <Card className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-arka-text-muted">
          Riwayat swap
        </p>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-arka-border/40"
            />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-xs text-arka-danger">{error}</p>
      </Card>
    );
  }

  if (executions.length === 0) {
    return (
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-arka-text-muted">
          Riwayat swap
        </p>
        <p className="mt-2 text-xs text-arka-text-muted">
          Belum ada swap yang dieksekusi. Chainlink Automation akan menjalankan
          swap pertama sesuai jadwal.
        </p>
      </Card>
    );
  }

  const totalIdrx = executions.reduce((s, e) => s + e.idrxSpent, BigInt(0));
  const totalSats = executions.reduce((s, e) => s + e.cbBTCReceived, BigInt(0));

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-arka-text-muted">
          Riwayat swap ({executions.length})
        </p>
      </div>

      <div className="flex gap-4 rounded-lg bg-arka-surface-muted/60 px-3 py-2">
        <div>
          <p className="text-[10px] uppercase text-arka-text-muted">Total IDRX</p>
          <p className="text-sm font-semibold tabular-nums">{formatIdrx(totalIdrx)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-arka-text-muted">Total cbBTC</p>
          <p className="text-sm font-semibold tabular-nums">{formatSats(totalSats)} sats</p>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {executions.map((exec) => (
          <SwapHistoryRow key={exec.transactionHash} exec={exec} />
        ))}
      </div>
    </Card>
  );
}

type Props = {
  order: DcaOrder;
  onCancelled: () => void;
};

export function DcaActiveOrder({ order, onCancelled }: Props) {
  const { cancel, busy, error } = useCancelDcaOrder();
  const [confirming, setConfirming] = useState(false);

  const handleCancel = useCallback(async () => {
    const hash = await cancel();
    if (hash) {
      setConfirming(false);
      onCancelled();
    }
  }, [cancel, onCancelled]);

  const remaining =
    order.totalSwaps === BigInt(0)
      ? "Tanpa batas"
      : `${order.executedSwaps}/${order.totalSwaps}`;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 border-green-300/40 bg-green-50/20">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <p className="text-sm font-medium text-arka-text">DCA Aktif</p>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-arka-text-muted">Per swap</dt>
            <dd className="font-medium tabular-nums">
              Rp {formatIdrx(order.amountPerSwap)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-arka-text-muted">Frekuensi</dt>
            <dd className="font-medium">{intervalLabel(order.interval)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-arka-text-muted">Eksekusi</dt>
            <dd className="font-medium tabular-nums">{remaining}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-arka-text-muted">Berikutnya</dt>
            <dd className="font-medium">{nextExecution(order)}</dd>
          </div>
          {order.minOutputBps > BigInt(0) && (
            <div className="flex justify-between gap-2">
              <dt className="text-arka-text-muted">Min. output</dt>
              <dd className="font-medium tabular-nums">
                {(Number(order.minOutputBps) / 100).toFixed(1)}%
              </dd>
            </div>
          )}
        </dl>
      </Card>

      <SwapHistory />

      {error && (
        <p className="text-sm text-arka-danger" role="alert">
          {error}
        </p>
      )}

      {confirming ? (
        <Card className="space-y-3 border-red-200/60 bg-red-50/30">
          <p className="text-sm text-arka-text">
            Yakin ingin membatalkan DCA? Sisa IDRX tetap di dompet kamu.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleCancel}
              disabled={busy}
              className="!bg-red-600 hover:!bg-red-700"
            >
              {busy ? "Membatalkan…" : "Ya, batalkan"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Kembali
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Batalkan DCA
        </Button>
      )}
    </div>
  );
}
