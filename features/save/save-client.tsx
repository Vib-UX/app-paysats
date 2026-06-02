"use client";

import { Card } from "@/components/ui/card";
import { GradButton } from "@/components/ui/grad-button";
import { InlinePanel } from "@/components/ui/inline-panel";
import { PillSeg } from "@/components/ui/pill-seg";
import { LogoMark } from "@/components/brand/logo";
import { useCurrency } from "@/lib/currency";
import { useDisplayUnit } from "@/lib/display-unit";
import { useT } from "@/lib/i18n";
import {
  CBBTC_DECIMALS,
  IDRX_DECIMALS,
} from "@/lib/contracts/paysats-dca";
import {
  useCreateDcaOrder,
  useCancelDcaOrder,
  useDcaExecutions,
  useDcaOrder,
} from "@/hooks/use-dca-contract";
import type { DcaOrder } from "@/lib/contracts/paysats-dca";
import { useCallback, useMemo, useState } from "react";

const IDR_PRESETS = [50_000, 100_000, 250_000, 500_000];
const BTC_PRICE_IDR_FALLBACK = 1_800_000_000; // ~ $109k · 16.5k
const IDR_PER_USD = 16_500;

const FREQ_OPTIONS = [
  { id: "daily" as const, seconds: 86_400, multiplier: 365 },
  { id: "weekly" as const, seconds: 604_800, multiplier: 52 },
  { id: "monthly" as const, seconds: 2_592_000, multiplier: 12 },
];

type FreqId = (typeof FREQ_OPTIONS)[number]["id"];

// Approximate 5-year total returns — used for the bitflation compare.
// Kept as static constants so the view works offline; values mirror the
// design reference (trailing 5y to 2024 region).
const MARKET_ASSETS = [
  {
    id: "btc" as const,
    nameKey: "save.market.btc" as const,
    return5y: 1.311,
    color: "var(--paysats-accent)",
  },
  {
    id: "spx" as const,
    nameKey: "save.market.spx" as const,
    return5y: 0.772,
    color: "#a78bfa",
  },
  {
    id: "gold" as const,
    nameKey: "save.market.gold" as const,
    return5y: 0.703,
    color: "#e8b84a",
  },
  {
    id: "ihsg" as const,
    nameKey: "save.market.ihsg" as const,
    return5y: 0.233,
    color: "#6fa8dc",
  },
  {
    id: "deposit" as const,
    nameKey: "save.market.deposit" as const,
    return5y: 0.119,
    color: "#b7b3ad",
  },
];

function intervalLabel(seconds: bigint, t: ReturnType<typeof useT>): string {
  const s = Number(seconds);
  if (s === 86_400) return t("dca.interval.daily");
  if (s === 604_800) return t("dca.interval.weekly");
  if (s === 2_592_000) return t("dca.interval.monthly");
  if (s < 3600) return `${Math.round(s / 60)} ${t("dca.interval.minutes")}`;
  if (s < 86_400) return `${Math.round(s / 3600)} ${t("dca.interval.hours")}`;
  return `${Math.round(s / 86_400)} ${t("dca.interval.days")}`;
}

function formatFiat(v: number, currency: "IDR" | "USD") {
  if (!Number.isFinite(v)) return "—";
  if (currency === "USD")
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `Rp ${v.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function formatFiatCompact(v: number, currency: "IDR" | "USD") {
  if (!Number.isFinite(v)) return "—";
  if (currency === "USD") {
    if (v >= 1_000_000)
      return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  }
  if (v >= 1_000_000_000)
    return `Rp ${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)
    return `Rp ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `Rp ${(v / 1_000).toFixed(0)}k`;
  return `Rp ${v.toFixed(0)}`;
}

// ---------- MarketCompare ----------

function MarketCompare({
  periodIdr,
  freq,
}: {
  periodIdr: number;
  freq: FreqId;
}) {
  const t = useT();
  const { currency } = useCurrency();
  const [open, setOpen] = useState(false);

  const freqCfg = FREQ_OPTIONS.find((o) => o.id === freq)!;
  const periodsIn5Years = freqCfg.multiplier * 5;
  const investedIdr = Math.max(0, periodIdr * periodsIn5Years);

  const rows = MARKET_ASSETS.map((a) => ({
    ...a,
    valueIdr: investedIdr * (1 + a.return5y),
  }));
  const maxValue = Math.max(1, ...rows.map((r) => r.valueIdr));

  const btc = rows[0];
  const multiple = 1 + btc.return5y;

  const subKey =
    freq === "daily"
      ? "save.market.subDay"
      : freq === "weekly"
        ? "save.market.subWeek"
        : "save.market.subMonth";
  const subTemplate = t(subKey);
  const sub = subTemplate.replace(
    "{amount}",
    Math.round(periodIdr).toLocaleString("id-ID"),
  );

  const investedStr = formatFiatCompact(
    currency === "USD" ? investedIdr / IDR_PER_USD : investedIdr,
    currency,
  );
  const btcValueStr = formatFiatCompact(
    currency === "USD" ? btc.valueIdr / IDR_PER_USD : btc.valueIdr,
    currency,
  );
  const callout = t("save.market.callout")
    .replace("{invested}", investedStr)
    .replace("{value}", btcValueStr)
    .replace("{multiple}", multiple.toFixed(1));

  return (
    <Card className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <div
          className="text-[13px] font-extrabold"
          style={{ color: "var(--paysats-text)" }}
        >
          {t("save.market.title")}
        </div>
        <span
          aria-hidden
          className="text-[14px] transition-transform"
          style={{
            color: "var(--paysats-text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ⌄
        </span>
      </button>

      <InlinePanel open={open}>
        <div className="space-y-3 pt-1">
          <div
            className="text-[11px]"
            style={{ color: "var(--paysats-text-faint)" }}
          >
            {sub}
          </div>

          <ul className="space-y-2.5">
            {rows.map((r) => {
              const pct = Math.max(4, (r.valueIdr / maxValue) * 100);
              const pctLabel = `+${(r.return5y * 100).toFixed(1)}%`;
              const fiatLabel = formatFiatCompact(
                currency === "USD" ? r.valueIdr / IDR_PER_USD : r.valueIdr,
                currency,
              );
              return (
                <li key={r.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span
                        className="text-[12px] font-extrabold"
                        style={{ color: "var(--paysats-text)" }}
                      >
                        {t(r.nameKey)}
                      </span>
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: r.color }}
                      >
                        {pctLabel}
                      </span>
                    </div>
                    <span
                      className="text-[12px] font-extrabold tabular-nums"
                      style={{ color: "var(--paysats-text)" }}
                    >
                      {fiatLabel}
                    </span>
                  </div>
                  <div
                    className="relative h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--paysats-surface-muted)" }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: r.color,
                        animation: "bar-rise 600ms ease both",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            className="rounded-[12px] border-l-2 px-3 py-2 text-[12px] leading-snug"
            style={{
              borderColor: "var(--paysats-accent)",
              background: "var(--paysats-accent-soft)",
              color: "var(--paysats-text)",
            }}
          >
            {callout}
          </div>

          <div
            className="text-[10px]"
            style={{ color: "var(--paysats-text-faint)" }}
          >
            {t("save.market.footnote")}
          </div>
        </div>
      </InlinePanel>
    </Card>
  );
}

// ---------- SaveSetup ----------

function SaveSetup({ onCreated }: { onCreated: () => void }) {
  const t = useT();
  const { currency } = useCurrency();
  const { format: formatUnit, label: unitLabel } = useDisplayUnit();
  const [amountIdr, setAmountIdr] = useState<number>(100_000);
  const [freq, setFreq] = useState<FreqId>("weekly");

  const create = useCreateDcaOrder();

  const freqCfg = FREQ_OPTIONS.find((o) => o.id === freq)!;

  const projectedYearIdr = amountIdr * freqCfg.multiplier;
  const projectedSats = Math.round(
    (projectedYearIdr / BTC_PRICE_IDR_FALLBACK) * 1e8,
  );

  const perPeriodSats = Math.round(
    (amountIdr / BTC_PRICE_IDR_FALLBACK) * 1e8,
  );

  const submit = useCallback(async () => {
    if (amountIdr < 1) return;
    const amountPerSwap =
      BigInt(Math.floor(amountIdr)) * BigInt(10 ** IDRX_DECIMALS);
    const interval = BigInt(freqCfg.seconds);
    const hash = await create.create({
      amountPerSwap,
      interval,
      totalSwaps: BigInt(0),
    });
    if (hash) onCreated();
  }, [amountIdr, freqCfg.seconds, create, onCreated]);

  return (
    <div className="space-y-5">
      <div
        className="relative overflow-hidden rounded-[22px] p-6 text-white"
        style={{
          background: "var(--paysats-gradient-hero)",
          backgroundSize: "300% 300%",
          animation: "grad-move 14s ease infinite",
          boxShadow: "var(--paysats-shadow-hero)",
        }}
      >
        <LogoMark
          className="pointer-events-none absolute -right-6 -top-4 h-24 w-24 opacity-10"
          aria-hidden
        />
        <div
          className="text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          {t("save.projectionTitle")}
        </div>
        <div
          className="mt-2.5 text-[34px] font-extrabold leading-none"
          style={{ letterSpacing: -0.8 }}
        >
          {formatUnit(projectedSats)} {unitLabel}
        </div>
        <div
          className="mt-2 text-[12px]"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          ≈ {formatFiat(
            currency === "USD"
              ? projectedYearIdr / 16_500
              : projectedYearIdr,
            currency,
          )}{" "}
          / {t("save.perYear")}
        </div>
      </div>

      <Card className="space-y-4">
        <div>
          <div
            className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--paysats-text-muted)" }}
          >
            {t("save.amountLabel")}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {IDR_PRESETS.map((p) => {
              const active = amountIdr === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmountIdr(p)}
                  className="rounded-[12px] px-2 py-2 text-[12px] font-extrabold"
                  style={{
                    color: active ? "#fff" : "var(--paysats-text)",
                    background: active
                      ? "var(--paysats-accent)"
                      : "var(--paysats-surface-muted)",
                  }}
                  data-pressable
                >
                  {(p / 1000).toFixed(0)}K
                </button>
              );
            })}
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={amountIdr}
            onChange={(e) => setAmountIdr(Number(e.target.value) || 0)}
            className="mt-3 w-full rounded-[12px] border px-3 py-2 text-[14px] font-semibold tabular-nums"
            style={{
              borderColor: "var(--paysats-border)",
              background: "var(--paysats-surface)",
              color: "var(--paysats-text)",
            }}
          />
        </div>

        <div>
          <div
            className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--paysats-text-muted)" }}
          >
            {t("dca.form.frequencyLabel")}
          </div>
          <PillSeg<FreqId>
            value={freq}
            onChange={setFreq}
            options={[
              { value: "daily", label: t("dca.interval.daily") },
              { value: "weekly", label: t("dca.interval.weekly") },
              { value: "monthly", label: t("dca.interval.monthly") },
            ]}
          />
        </div>
      </Card>

      <MarketCompare periodIdr={amountIdr} freq={freq} />

      {create.error ? (
        <p className="text-xs" style={{ color: "var(--paysats-danger)" }}>
          {create.error}
        </p>
      ) : null}

      <GradButton onClick={submit} disabled={create.busy}>
        {create.busy
          ? t("dca.form.submitting")
          : `${t("save.startBtn")} · ${formatUnit(perPeriodSats)} ${unitLabel} / ${freq === "daily" ? t("save.day") : freq === "weekly" ? t("save.week") : t("save.month")}`}
      </GradButton>
    </div>
  );
}

// ---------- SaveActive ----------

function SaveActive({
  order,
  onCancelled,
}: {
  order: DcaOrder;
  onCancelled: () => void;
}) {
  const t = useT();
  const { currency } = useCurrency();
  const { format: formatUnit, label: unitLabel } = useDisplayUnit();
  const { executions } = useDcaExecutions();
  const cancel = useCancelDcaOrder();
  const [confirming, setConfirming] = useState(false);

  const totalSats = useMemo(
    () => executions.reduce((s, e) => s + e.cbBTCReceived, BigInt(0)),
    [executions],
  );
  const totalIdrx = useMemo(
    () => executions.reduce((s, e) => s + e.idrxSpent, BigInt(0)),
    [executions],
  );

  const accumulatedSats = Number(totalSats);
  const investedIdr = Number(totalIdrx) / 10 ** IDRX_DECIMALS;
  const investedFiat =
    currency === "USD" ? investedIdr / 16_500 : investedIdr;

  const perSwapIdr = Number(order.amountPerSwap) / 10 ** IDRX_DECIMALS;
  const perSwapFiat =
    currency === "USD" ? perSwapIdr / 16_500 : perSwapIdr;

  const intervalSec = Number(order.interval);
  const marketFreq: FreqId =
    intervalSec <= 86_400
      ? "daily"
      : intervalSec <= 604_800
        ? "weekly"
        : "monthly";

  const doCancel = useCallback(async () => {
    const hash = await cancel.cancel();
    if (hash) {
      setConfirming(false);
      onCancelled();
    }
  }, [cancel, onCancelled]);

  const nextExecutionLabel = useMemo(() => {
    if (order.lastExecutedAt === BigInt(0)) return t("dca.soon");
    const nextTs = Number(order.lastExecutedAt + order.interval);
    const now = Math.floor(Date.now() / 1000);
    if (nextTs <= now) return t("dca.waitingKeeper");
    return new Date(nextTs * 1000).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [order, t]);

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-[22px] p-6 text-white"
        style={{
          background: "var(--paysats-gradient-hero)",
          backgroundSize: "300% 300%",
          animation: "grad-move 14s ease infinite",
          boxShadow: "var(--paysats-shadow-hero)",
        }}
      >
        <LogoMark
          className="pointer-events-none absolute -right-6 -top-4 h-24 w-24 opacity-10"
          aria-hidden
        />
        <div
          className="text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          {t("save.accumulatedTitle")}
        </div>
        <div
          className="mt-2.5 text-[34px] font-extrabold leading-none"
          style={{ letterSpacing: -0.8 }}
        >
          {formatUnit(accumulatedSats)} {unitLabel}
        </div>
        <div
          className="mt-2 text-[12px]"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {t("save.invested")}: {formatFiat(investedFiat, currency)}
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between py-2">
          <span
            className="text-[12px]"
            style={{ color: "var(--paysats-text-muted)" }}
          >
            {t("dca.perSwap")}
          </span>
          <span className="text-[13px] font-extrabold tabular-nums">
            {formatFiat(perSwapFiat, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span
            className="text-[12px]"
            style={{ color: "var(--paysats-text-muted)" }}
          >
            {t("dca.frequency")}
          </span>
          <span className="text-[13px] font-extrabold">
            {intervalLabel(order.interval, t)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span
            className="text-[12px]"
            style={{ color: "var(--paysats-text-muted)" }}
          >
            {t("dca.next")}
          </span>
          <span className="text-[13px] font-extrabold">
            {nextExecutionLabel}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span
            className="text-[12px]"
            style={{ color: "var(--paysats-text-muted)" }}
          >
            {t("dca.executions")}
          </span>
          <span className="text-[13px] font-extrabold tabular-nums">
            {order.totalSwaps === BigInt(0)
              ? t("dca.unlimited")
              : `${order.executedSwaps}/${order.totalSwaps}`}
          </span>
        </div>
      </Card>

      <InlinePanel open={confirming}>
        <Card className="space-y-3">
          <p className="text-[13px]" style={{ color: "var(--paysats-text)" }}>
            {t("dca.cancelConfirm")}
          </p>
          {cancel.error ? (
            <p className="text-xs" style={{ color: "var(--paysats-danger)" }}>
              {cancel.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doCancel}
              disabled={cancel.busy}
              className="flex-1 rounded-[12px] px-3 py-3 text-[13px] font-extrabold"
              style={{ background: "var(--paysats-danger)", color: "#fff" }}
              data-pressable
            >
              {cancel.busy ? t("dca.cancelling") : t("dca.cancelYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-[12px] px-3 py-3 text-[13px] font-extrabold"
              style={{
                background: "var(--paysats-surface-muted)",
                color: "var(--paysats-text)",
              }}
              data-pressable
            >
              {t("dca.cancelBack")}
            </button>
          </div>
        </Card>
      </InlinePanel>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-[14px] px-3 py-3 text-[13px] font-extrabold"
          style={{
            background: "var(--paysats-surface)",
            color: "var(--paysats-text)",
            boxShadow: "var(--paysats-shadow-card)",
          }}
          data-pressable
        >
          {t("dca.cancelBtn")}
        </button>
      ) : null}

      <MarketCompare periodIdr={perSwapIdr} freq={marketFreq} />

      <RecentBuys />
    </div>
  );
}

function RecentBuys() {
  const t = useT();
  const { executions } = useDcaExecutions();
  const { format: formatUnit, label: unitLabel, unit } = useDisplayUnit();
  if (!executions.length) return null;
  const rows = executions.slice(0, 5);
  return (
    <Card className="space-y-2">
      <div
        className="text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "var(--paysats-text-muted)" }}
      >
        {t("save.recentBuys")}
      </div>
      <div className="space-y-1.5">
        {rows.map((e) => {
          const sats = Number(e.cbBTCReceived);
          const idr = Number(e.idrxSpent) / 10 ** IDRX_DECIMALS;
          const btc = Number(e.cbBTCReceived) / 10 ** CBBTC_DECIMALS;
          return (
            <div
              key={e.transactionHash}
              className="flex items-center justify-between rounded-[10px] px-2 py-1.5"
              style={{ background: "var(--paysats-surface-muted)" }}
            >
              <div className="min-w-0">
                <div className="text-[12px] font-semibold tabular-nums">
                  +{formatUnit(sats)} {unitLabel}
                </div>
                {unit === "SATS" ? (
                  <div
                    className="text-[10px]"
                    style={{ color: "var(--paysats-text-muted)" }}
                  >
                    {btc.toFixed(8)} BTC
                  </div>
                ) : null}
              </div>
              <div
                className="text-[11px] tabular-nums"
                style={{ color: "var(--paysats-text-muted)" }}
              >
                Rp {idr.toLocaleString("id-ID")}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Root ----------

function BackHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-12">
      <a
        href="/home"
        aria-label="Back"
        className="flex h-10 w-10 items-center justify-center rounded-[12px]"
        data-pressable
        style={{
          background: "var(--paysats-surface)",
          boxShadow: "var(--paysats-shadow-card)",
          color: "var(--paysats-text)",
        }}
      >
        ←
      </a>
      <div
        className="text-lg font-extrabold"
        style={{ color: "var(--paysats-text)", letterSpacing: -0.4 }}
      >
        {title}
      </div>
    </div>
  );
}

export function SaveClient() {
  const { order, loading, refetch } = useDcaOrder();
  const t = useT();

  return (
    <div className="px-5 pb-14">
      <BackHeader title={t("save.title")} />
      <div className="mt-5">
        {loading && !order ? (
          <Card>
            <div className="h-28 animate-pulse rounded bg-paysats-border/40" />
          </Card>
        ) : order ? (
          <SaveActive order={order} onCancelled={refetch} />
        ) : (
          <SaveSetup onCreated={refetch} />
        )}
      </div>
    </div>
  );
}
