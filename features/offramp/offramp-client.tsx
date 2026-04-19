"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  MAX_REDEEM_USD,
  MIN_REDEEM_USD,
  formatIdr,
  formatUsd,
  usePayoutDestinations,
  useRedeemHistory,
  useRedeemRate,
  useRedeemUsdc,
  type PayoutDestinationView,
} from "@/hooks/use-offramp";
import { useT } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { DestinationForm } from "./destination-form";
import { RedeemStatusCard } from "./redeem-status-card";

type Props = {
  /** Smart wallet USDC balance (6-decimal raw bigint) */
  usdcBalance: bigint;
};

export function OfframpClient({ usdcBalance }: Props) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [confirming, setConfirming] = useState(false);

  const {
    destinations,
    loading: destsLoading,
    remove,
    setDefault,
  } = usePayoutDestinations();
  const { records, loading: historyLoading } = useRedeemHistory();
  const { redeem, busy, error: redeemError, txHash } = useRedeemUsdc();

  // Default selection: the user's default destination, else the first one.
  const effectiveSelectedId =
    selectedId ??
    destinations.find((d) => d.isDefault)?.id ??
    destinations[0]?.id ??
    null;

  const selected = useMemo(
    () => destinations.find((d) => d.id === effectiveSelectedId) ?? null,
    [destinations, effectiveSelectedId],
  );

  const usdAmount = Number(amountInput);
  const { quote, loading: quoteLoading } = useRedeemRate(
    Number.isFinite(usdAmount) && usdAmount > 0 ? usdAmount : 0,
  );

  const usdcBalanceNum = Number(usdcBalance) / 1_000_000;

  // Guardrails
  const overMax = usdAmount > MAX_REDEEM_USD;
  const underMin = amountInput.length > 0 && usdAmount < MIN_REDEEM_USD;
  const insufficient = usdAmount > usdcBalanceNum + 1e-6;

  // Per-destination IDRX max is in IDR; compare against quote.grossIdr if present.
  const overBankMax = useMemo(() => {
    if (!selected?.maxAmountTransfer) return false;
    if (!quote?.grossIdr) return false;
    return quote.grossIdr > Number(selected.maxAmountTransfer);
  }, [selected, quote]);

  const errorMessage =
    overMax
      ? t("offramp.redeemOverMax")
      : underMin
        ? t("offramp.redeemUnderMin")
        : insufficient
          ? t("offramp.redeemInsufficient")
          : overBankMax
            ? t("offramp.redeemOverBankMax")
            : null;

  const canSubmit =
    !!selected &&
    Number.isFinite(usdAmount) &&
    usdAmount >= MIN_REDEEM_USD &&
    usdAmount <= MAX_REDEEM_USD &&
    !insufficient &&
    !overBankMax &&
    !busy;

  const handleRedeem = async () => {
    if (!canSubmit || !selected) return;
    setConfirming(false);
    const hash = await redeem({
      destination: selected,
      usdAmount,
      idrQuoteRaw: quote?.expectedIdr ? String(quote.expectedIdr) : undefined,
    });
    if (hash) {
      setAmountInput("");
    }
  };

  // History section is rendered in both collapsed + expanded states, so users
  // can always get to their past/ongoing redeems — even after their USDC
  // balance hits 0 from a successful cashout.
  const historySection = (
    <section className="space-y-2">
      <p className="text-sm font-semibold text-arka-text">
        {t("offramp.historyTitle")}
      </p>
      {historyLoading && records.length === 0 && (
        <p className="text-xs text-arka-text-muted">{t("auth.loading")}</p>
      )}
      {!historyLoading && records.length === 0 && (
        <Card>
          <p className="text-xs text-arka-text-muted">
            {t("offramp.historyEmpty")}
          </p>
        </Card>
      )}
      {records.map((r) => (
        <RedeemStatusCard key={r.id} record={r} />
      ))}
    </section>
  );

  if (!expanded) {
    return (
      <div className="space-y-3">
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-arka-text">
              {t("offramp.sectionTitle")}
            </p>
            <p className="mt-0.5 text-xs text-arka-text-muted">
              {t("offramp.sectionDesc")}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setExpanded(true)}
            className="w-auto min-w-[7rem]"
          >
            {t("offramp.openBtn")}
          </Button>
        </Card>
        {historySection}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-arka-text">
            {t("offramp.sectionTitle")}
          </p>
          <p className="text-xs text-arka-text-muted">
            {t("offramp.sectionDesc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-arka-text-muted hover:text-arka-text"
        >
          {t("offramp.closeBtn")}
        </button>
      </div>

      {/* Destinations list */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-arka-text">
            {t("offramp.destinationsTitle")}
          </p>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="text-xs font-medium text-arka-accent hover:underline"
            >
              + {t("offramp.addDestination")}
            </button>
          )}
        </div>

        {destsLoading && destinations.length === 0 && (
          <p className="text-xs text-arka-text-muted">{t("auth.loading")}</p>
        )}

        {!destsLoading && destinations.length === 0 && !showAddForm && (
          <p className="text-xs text-arka-text-muted">
            {t("offramp.noDestinations")}
          </p>
        )}

        {destinations.length > 0 && (
          <div className="space-y-2">
            {destinations.map((d) => (
              <DestinationRow
                key={d.id}
                destination={d}
                selected={effectiveSelectedId === d.id}
                onSelect={() => setSelectedId(d.id)}
                onDelete={async () => {
                  if (!confirm(t("offramp.confirmDelete"))) return;
                  await remove(d.id);
                }}
                onSetDefault={async () => {
                  await setDefault(d.id);
                }}
              />
            ))}
          </div>
        )}
      </Card>

      {showAddForm && (
        <DestinationForm
          onCancel={() => setShowAddForm(false)}
          onAdded={(d) => {
            setShowAddForm(false);
            setSelectedId(d.id);
          }}
        />
      )}

      {/* Redeem form */}
      {destinations.length > 0 && selected && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-arka-text">
            {t("offramp.redeemTitle")}
          </p>

          <div>
            <Label>{t("offramp.redeemDestLabel")}</Label>
            <div className="rounded-lg bg-arka-surface-muted p-2.5 text-sm">
              <p className="font-medium text-arka-text">
                {selected.bankName}{" "}
                <span className="text-arka-text-muted">
                  ({selected.kind === "ewallet"
                    ? t("offramp.kindEwallet")
                    : t("offramp.kindBank")})
                </span>
              </p>
              <p className="font-mono text-xs text-arka-text-muted">
                •••• {selected.bankAccountNumberLast} ·{" "}
                {selected.bankAccountName}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="redeem-amount">
              {t("offramp.redeemAmountLabel")}
            </Label>
            <div className="relative">
              <Input
                id="redeem-amount"
                inputMode="decimal"
                type="number"
                min={MIN_REDEEM_USD}
                max={MAX_REDEEM_USD}
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="pr-14 font-mono"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-arka-text-muted">
                USD
              </span>
            </div>
            <p className="mt-1 flex items-center justify-between text-xs text-arka-text-muted">
              <span>{t("offramp.redeemAmountHint")}</span>
              <button
                type="button"
                onClick={() =>
                  setAmountInput(
                    Math.min(MAX_REDEEM_USD, usdcBalanceNum).toFixed(2),
                  )
                }
                className="font-semibold text-arka-accent hover:underline"
              >
                {formatUsd(usdcBalanceNum)}
              </button>
            </p>
          </div>

          {quote && quote.expectedIdr > 0 && (
            <div className="rounded-lg bg-arka-surface-muted p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-arka-text-muted">
                  {t("offramp.redeemQuoteLabel")}
                </span>
                <span className="font-mono font-semibold text-arka-text">
                  {quoteLoading ? "…" : formatIdr(quote.expectedIdr)}
                </span>
              </div>
              {quote.feeIdr > 0 && (
                <div className="mt-1 flex items-center justify-between text-xs text-arka-text-muted">
                  <span>{t("offramp.redeemQuoteFee")}</span>
                  <span className="font-mono">
                    {formatIdr(quote.feeIdr)}
                  </span>
                </div>
              )}
              {quote.rate > 0 && (
                <div className="mt-1 flex items-center justify-between text-xs text-arka-text-muted">
                  <span>{t("offramp.redeemQuoteRate")}</span>
                  <span className="font-mono">
                    1 USD ≈ {formatIdr(quote.rate)}
                  </span>
                </div>
              )}
              {quote.source === "fallback" && (
                <p className="mt-1 text-[11px] text-arka-text-muted">
                  {t("offramp.redeemQuoteFallback")}
                </p>
              )}
            </div>
          )}

          {errorMessage && (
            <p className="text-xs text-arka-danger">{errorMessage}</p>
          )}
          {redeemError && (
            <p className="text-xs text-arka-danger">{redeemError}</p>
          )}

          {txHash ? (
            <div className="rounded-lg bg-green-500/10 p-3 text-sm">
              <p className="font-semibold text-green-700">
                {t("offramp.redeemSent")}
              </p>
              <p className="mt-0.5 text-xs text-green-700/80">
                {t("offramp.redeemSentDesc")}
              </p>
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs font-medium text-green-700 underline"
              >
                {t("credit.viewBasescan")} →
              </a>
            </div>
          ) : confirming ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-arka-text">
                {t("offramp.redeemConfirmTitle")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setConfirming(false)}
                >
                  {t("offramp.closeBtn")}
                </Button>
                <Button onClick={handleRedeem} disabled={busy}>
                  {busy
                    ? t("offramp.redeemSubmitting")
                    : t("offramp.redeemSubmit")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setConfirming(true)}
              disabled={!canSubmit}
            >
              {t("offramp.redeemSubmit")}
            </Button>
          )}
        </Card>
      )}

      {historySection}
    </div>
  );
}

function DestinationRow({
  destination,
  selected,
  onSelect,
  onDelete,
  onSetDefault,
}: {
  destination: PayoutDestinationView;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const t = useT();
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition ${
        selected
          ? "border-arka-accent bg-arka-accent/5"
          : "border-arka-border bg-arka-surface"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            destination.kind === "ewallet"
              ? "bg-purple-500/10 text-purple-600"
              : "bg-blue-500/10 text-blue-600"
          }`}
          aria-hidden
        >
          {destination.kind === "ewallet" ? "W" : "B"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-arka-text">
              {destination.bankName}
            </span>
            {destination.isDefault && (
              <span className="shrink-0 rounded-full bg-arka-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-arka-accent">
                {t("offramp.default")}
              </span>
            )}
          </span>
          <span className="block truncate font-mono text-[11px] text-arka-text-muted">
            •••• {destination.bankAccountNumberLast} ·{" "}
            {destination.bankAccountName}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {!destination.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="text-[11px] text-arka-accent hover:underline"
          >
            {t("offramp.setDefault")}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="text-[11px] text-arka-text-muted hover:text-arka-danger"
        >
          {t("offramp.delete")}
        </button>
      </div>
    </div>
  );
}
