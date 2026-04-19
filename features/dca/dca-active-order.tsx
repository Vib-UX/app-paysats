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
import { useLocale, useT } from "@/lib/i18n";
import { useCallback, useState } from "react";

function formatIdrx(raw: bigint, localeStr: string): string {
  const n = Number(raw) / 10 ** IDRX_DECIMALS;
  return n.toLocaleString(localeStr, { maximumFractionDigits: 2 });
}

function formatSats(raw: bigint, localeStr: string): string {
  return Number(raw).toLocaleString(localeStr, { maximumFractionDigits: 0 });
}

function formatBtc(raw: bigint, localeStr: string): string {
  const n = Number(raw) / 10 ** CBBTC_DECIMALS;
  return n.toLocaleString(localeStr, { maximumFractionDigits: 8, minimumFractionDigits: 2 });
}

function intervalLabel(seconds: bigint, t: ReturnType<typeof useT>): string {
  const s = Number(seconds);
  const keys: Record<number, Parameters<typeof t>[0]> = {
    86_400: "dca.interval.daily",
    604_800: "dca.interval.weekly",
    2_592_000: "dca.interval.monthly",
  };
  const match = INTERVAL_PRESETS.find((p) => p.seconds === s);
  if (match) return t(keys[match.seconds]);
  if (s < 3600) return `${Math.round(s / 60)} ${t("dca.interval.minutes")}`;
  if (s < 86_400) return `${Math.round(s / 3600)} ${t("dca.interval.hours")}`;
  return `${Math.round(s / 86_400)} ${t("dca.interval.days")}`;
}

function nextExecution(order: DcaOrder, t: ReturnType<typeof useT>, localeStr: string): string {
  if (order.lastExecutedAt === BigInt(0)) return t("dca.soon");
  const nextTs = Number(order.lastExecutedAt + order.interval);
  const now = Math.floor(Date.now() / 1000);
  if (nextTs <= now) return t("dca.waitingKeeper");
  const d = new Date(nextTs * 1000);
  return d.toLocaleString(localeStr, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SwapHistoryRow({ exec, localeStr }: { exec: DcaExecution; localeStr: string }) {
  const txUrl = `https://basescan.org/tx/${exec.transactionHash}`;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-arka-border/30 py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-arka-text">
          {formatIdrx(exec.idrxSpent, localeStr)} IDRX → {formatSats(exec.cbBTCReceived, localeStr)} sats
        </p>
        <p className="text-[10px] text-arka-text-muted">
          {formatBtc(exec.cbBTCReceived, localeStr)} cbBTC
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

export function SwapHistory() {
  const { executions, loading, error } = useDcaExecutions();
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";

  if (loading) {
    return (
      <Card className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-arka-text-muted">
          {t("dca.swapHistory")}
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
          {t("dca.swapHistory")}
        </p>
        <p className="mt-2 text-xs text-arka-text-muted">
          {t("dca.noSwapsYet")}
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
          {t("dca.swapHistory")} ({executions.length})
        </p>
      </div>

      <div className="flex gap-4 rounded-lg bg-arka-surface-muted/60 px-3 py-2">
        <div>
          <p className="text-[10px] uppercase text-arka-text-muted">{t("dca.totalIdrx")}</p>
          <p className="text-sm font-semibold tabular-nums">{formatIdrx(totalIdrx, localeStr)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-arka-text-muted">{t("dca.totalBtc")}</p>
          <p className="text-sm font-semibold tabular-nums">{formatSats(totalSats, localeStr)} sats</p>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {executions.map((exec) => (
          <SwapHistoryRow key={exec.transactionHash} exec={exec} localeStr={localeStr} />
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
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";

  const handleCancel = useCallback(async () => {
    const hash = await cancel();
    if (hash) {
      setConfirming(false);
      onCancelled();
    }
  }, [cancel, onCancelled]);

  const remaining =
    order.totalSwaps === BigInt(0)
      ? t("dca.unlimited")
      : `${order.executedSwaps}/${order.totalSwaps}`;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 border-green-300/40 bg-green-50/20">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <p className="text-sm font-medium text-arka-text">{t("dca.active")}</p>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-arka-text-muted">{t("dca.perSwap")}</dt>
            <dd className="font-medium tabular-nums">
              Rp {formatIdrx(order.amountPerSwap, localeStr)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-arka-text-muted">{t("dca.frequency")}</dt>
            <dd className="font-medium">{intervalLabel(order.interval, t)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-arka-text-muted">{t("dca.executions")}</dt>
            <dd className="font-medium tabular-nums">{remaining}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-arka-text-muted">{t("dca.next")}</dt>
            <dd className="font-medium">{nextExecution(order, t, localeStr)}</dd>
          </div>
          {order.minOutputBps > BigInt(0) && (
            <div className="flex justify-between gap-2">
              <dt className="text-arka-text-muted">{t("dca.minOutput")}</dt>
              <dd className="font-medium tabular-nums">
                {(Number(order.minOutputBps) / 100).toFixed(1)}%
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {error && (
        <p className="text-sm text-arka-danger" role="alert">
          {error}
        </p>
      )}

      {confirming ? (
        <Card className="space-y-3 border-red-200/60 bg-red-50/30">
          <p className="text-sm text-arka-text">
            {t("dca.cancelConfirm")}
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleCancel}
              disabled={busy}
              className="!bg-red-600 hover:!bg-red-700"
            >
              {busy ? t("dca.cancelling") : t("dca.cancelYes")}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t("dca.cancelBack")}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          {t("dca.cancelBtn")}
        </Button>
      )}
    </div>
  );
}
