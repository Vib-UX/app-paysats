"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { useLocale, useT } from "@/lib/i18n";
import { useDcaOrder } from "@/hooks/use-dca-contract";
import { IDRX_DECIMALS } from "@/lib/contracts/arka-dca";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  runDcaBtc,
  runDcaIhsg,
  runDcaGold,
  runDcaDeposito,
  type DcaInputs,
  type DcaResult,
  type DailyPoint,
} from "@predator_757/bitflation-idr-dca";
import type { DepositoRate } from "@predator_757/bitflation-idr-dca";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useHistoricalData } from "./use-historical-data";

const DEFAULT_AMOUNT_IDR = 100_000;
const DEFAULT_YEARS = 6;

function CalculatorSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-arka-border/60" />
      <div className="h-4 w-full max-w-md animate-pulse rounded bg-arka-border/40" />
      <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-arka-border/40" />
    </div>
  );
}

function formatIdr(n: number): string {
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `Rp ${(n / 1e3).toFixed(0)}K`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

type FreqKey = "daily" | "weekly" | "monthly";

function intervalToFreq(seconds: bigint): FreqKey {
  const s = Number(seconds);
  if (s <= 86_400) return "daily";
  if (s <= 604_800) return "weekly";
  return "monthly";
}

function SavingsVisualization({
  amountIdr,
  freq,
  yearsAgo,
  btcDaily,
  ihsgDaily,
  goldDaily,
  depositoRates,
}: {
  amountIdr: number;
  freq: FreqKey;
  yearsAgo: number;
  btcDaily: DailyPoint[];
  ihsgDaily: DailyPoint[];
  goldDaily: DailyPoint[];
  depositoRates: DepositoRate[];
}) {
  const t = useT();

  const inputs: DcaInputs = useMemo(
    () => ({
      amountPerPeriodIdr: amountIdr,
      frequency: freq,
      yearsAgo,
      btcDaily,
      ihsgDaily,
      goldDaily,
      depositoRates,
    }),
    [amountIdr, freq, yearsAgo, btcDaily, ihsgDaily, goldDaily, depositoRates],
  );

  const results = useMemo(
    () => ({
      btc: runDcaBtc(inputs),
      ihsg: runDcaIhsg(inputs),
      gold: runDcaGold(inputs),
      deposito: runDcaDeposito(inputs),
    }),
    [inputs],
  );

  const chartData = useMemo(() => {
    const series = results.btc.series;
    const invested = results.btc.totalInvested;
    const raw = series.map(({ date, portfolioValue }) => ({
      date,
      invested,
      btc: portfolioValue,
      gold:
        results.gold.series.find((s) => s.date === date)?.portfolioValue ?? 0,
      ihsg:
        results.ihsg.series.find((s) => s.date === date)?.portfolioValue ?? 0,
    }));
    const maxPoints = 200;
    if (raw.length <= maxPoints) return raw;
    const step = Math.ceil(raw.length / maxPoints);
    return raw.filter((_, i) => i % step === 0 || i === raw.length - 1);
  }, [results]);

  const assets: {
    key: "btc" | "gold" | "ihsg" | "deposito";
    labelKey:
      | "savings.btc"
      | "savings.gold"
      | "savings.ihsg"
      | "savings.deposito";
    color: string;
    result: DcaResult;
  }[] = [
    { key: "btc", labelKey: "savings.btc", color: "#f97316", result: results.btc },
    { key: "gold", labelKey: "savings.gold", color: "#eab308", result: results.gold },
    { key: "ihsg", labelKey: "savings.ihsg", color: "#3b82f6", result: results.ihsg },
    { key: "deposito", labelKey: "savings.deposito", color: "#71717a", result: results.deposito },
  ];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-3">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
          >
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(0, 7)}
              fontSize={10}
              stroke="var(--arka-text-muted)"
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) =>
                v >= 1e9
                  ? `${(v / 1e9).toFixed(0)}B`
                  : v >= 1e6
                    ? `${(v / 1e6).toFixed(0)}M`
                    : `${(v / 1e3).toFixed(0)}K`
              }
              fontSize={10}
              stroke="var(--arka-text-muted)"
              tickLine={false}
              width={42}
            />
            <Tooltip
              formatter={(value) => formatIdr(Number(value ?? 0))}
              labelFormatter={(d) => String(d)}
              contentStyle={{
                backgroundColor: "var(--arka-surface)",
                border: "1px solid var(--arka-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <ReferenceLine
              y={results.btc.totalInvested}
              stroke="var(--arka-text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="btc"
              name={t("savings.btc")}
              stroke="#f97316"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="gold"
              name={t("savings.gold")}
              stroke="#eab308"
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              type="monotone"
              dataKey="ihsg"
              name={t("savings.ihsg")}
              stroke="#3b82f6"
              dot={false}
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        {assets.map(({ key, labelKey, color, result: r }) => (
          <Card
            key={key}
            className={`space-y-1.5 p-3 ${key === "btc" ? "border-orange-300/40" : ""}`}
          >
            <p className="text-xs font-bold" style={{ color }}>
              {t(labelKey)}
            </p>
            <div className="flex justify-between text-[11px]">
              <span className="text-arka-text-muted">
                {t("savings.currentValue")}
              </span>
              <span className="font-semibold tabular-nums text-arka-text">
                {formatIdr(r.currentValue)}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-arka-text-muted">
                {t("savings.returnLabel")}
              </span>
              <span
                className={`font-semibold tabular-nums ${r.returnPct >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {r.returnPct >= 0 ? "+" : ""}
                {r.returnPct.toFixed(1)}%
              </span>
            </div>
            <p className="text-[10px] text-arka-text-muted">
              {t("savings.invested")}: {formatIdr(r.totalInvested)}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SavingsClient() {
  const t = useT();
  const { locale } = useLocale();
  const { order, loading: orderLoading } = useDcaOrder();
  const { btcDaily, ihsgDaily, goldDaily, depositoRates, loaded } =
    useHistoricalData();

  const hasDca = !!order;
  const [modeOverride, setModeOverride] = useState<
    "dca" | "calculator" | null
  >(null);
  const mode = modeOverride ?? (hasDca ? "dca" : "calculator");
  const [years, setYears] = useState(DEFAULT_YEARS);
  const [calcAmount, setCalcAmount] = useState(DEFAULT_AMOUNT_IDR);

  const amountIdr =
    mode === "dca" && order
      ? Number(order.amountPerSwap) / 10 ** IDRX_DECIMALS
      : calcAmount;
  const freq: FreqKey = order ? intervalToFreq(order.interval) : "monthly";
  const yearsAgo = mode === "calculator" ? years : DEFAULT_YEARS;
  const freqLabel = t(
    `savings.${freq}` as "savings.daily" | "savings.weekly" | "savings.monthly",
  );
  const localeStr = locale === "id" ? "id-ID" : "en-US";

  const isLoading = orderLoading || !loaded || btcDaily.length === 0;

  return (
    <Screen title={t("savings.title")} subtitle={t("savings.subtitle")}>
      <div className="space-y-5">
        {/* Mode toggle — only when user has active DCA */}
        {hasDca && (
          <div className="inline-flex rounded-lg bg-arka-surface-muted p-0.5">
            <button
              type="button"
              onClick={() => setModeOverride("dca")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === "dca"
                  ? "bg-arka-accent text-white shadow-sm"
                  : "text-arka-text-muted hover:text-arka-text"
              }`}
            >
              {t("savings.modeDca")}
            </button>
            <button
              type="button"
              onClick={() => setModeOverride("calculator")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                mode === "calculator"
                  ? "bg-arka-accent text-white shadow-sm"
                  : "text-arka-text-muted hover:text-arka-text"
              }`}
            >
              {t("savings.modeCalculator")}
            </button>
          </div>
        )}

        {/* Current DCA header */}
        {mode === "dca" && order && (
          <div>
            <h2 className="text-base font-semibold text-arka-text">
              {t("savings.projectedTitle")}
            </h2>
            <p className="mt-1 text-xs text-arka-text-muted">
              {t("savings.projectedDesc")}
            </p>
            <p className="mt-1 text-xs font-medium text-arka-accent">
              Rp {amountIdr.toLocaleString(localeStr)} {t("savings.perFreq")}{" "}
              {freqLabel}
            </p>
          </div>
        )}

        {/* Calculator mode: amount + year sliders */}
        {mode === "calculator" && (
          <div className="space-y-5">
            {/* Amount slider */}
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold tabular-nums text-arka-text">
                  Rp {calcAmount.toLocaleString(localeStr)}
                </span>
                <span className="text-xs text-arka-text-muted">
                  / {freqLabel}
                </span>
              </div>
              <input
                type="range"
                min={50_000}
                max={5_000_000}
                step={50_000}
                value={calcAmount}
                onChange={(e) => setCalcAmount(Number(e.target.value))}
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-arka-border/40 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-arka-accent [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-arka-accent [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="mt-1 flex justify-between text-[10px] text-arka-text-muted">
                <span>Rp 50K</span>
                <span>Rp 5M</span>
              </div>
            </div>

            {/* Year slider */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums text-arka-text">
                  {years}
                </span>
                <span className="text-xs text-arka-text-muted">
                  {t("savings.years")}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-arka-border/40 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-arka-accent [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-arka-accent [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="mt-1 flex justify-between text-[10px] text-arka-text-muted">
                <span>1</span>
                <span>10</span>
              </div>
            </div>
          </div>
        )}

        {/* Chart + scoreboard */}
        {isLoading ? (
          <CalculatorSkeleton />
        ) : (
          <SavingsVisualization
            amountIdr={amountIdr}
            freq={freq}
            yearsAgo={yearsAgo}
            btcDaily={btcDaily}
            ihsgDaily={ihsgDaily}
            goldDaily={goldDaily}
            depositoRates={depositoRates}
          />
        )}

        {/* Create DCA nudge for users without active DCA */}
        {!hasDca && !orderLoading && (
          <Card className="space-y-3 border-dashed">
            <p className="text-sm text-arka-text-muted">{t("savings.noDca")}</p>
            <Link href="/dca">
              <Button variant="primary" className="w-full sm:w-auto">
                {t("savings.noDcaBtn")}
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </Screen>
  );
}
