"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  IDRX_DECIMALS,
  INTERVAL_PRESETS,
} from "@/lib/contracts/arka-dca";
import { useCreateDcaOrder } from "@/hooks/use-dca-contract";
import { useT } from "@/lib/i18n";
import { useCallback, useState } from "react";

type Props = {
  onCreated: () => void;
};

const INTERVAL_KEYS: Record<number, "dca.interval.daily" | "dca.interval.weekly" | "dca.interval.monthly"> = {
  86_400: "dca.interval.daily",
  604_800: "dca.interval.weekly",
  2_592_000: "dca.interval.monthly",
};

export function DcaForm({ onCreated }: Props) {
  const { create, busy, error: txError, txHash } = useCreateDcaOrder();
  const t = useT();

  const [amountIdr, setAmountIdr] = useState("");
  const [intervalIdx, setIntervalIdx] = useState(0);
  const [totalSwaps, setTotalSwaps] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);

    const raw = amountIdr.replace(/\./g, "").replace(/,/g, "").trim();
    const idrAmount = Number(raw);
    if (!raw || Number.isNaN(idrAmount) || idrAmount < 1) {
      setError(t("dca.form.errorAmount"));
      return;
    }

    const swapsRaw = totalSwaps.trim();
    const swapsNum = swapsRaw === "" ? 0 : Number(swapsRaw);
    if (Number.isNaN(swapsNum) || swapsNum < 0 || swapsNum % 1 !== 0) {
      setError(t("dca.form.errorSwaps"));
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
  }, [amountIdr, intervalIdx, totalSwaps, create, onCreated, t]);

  if (txHash) {
    return (
      <Card className="space-y-3 border-green-300/50 bg-green-50/30">
        <p className="text-sm font-medium text-arka-text">
          {t("dca.form.success")}
        </p>
        <p className="text-xs text-arka-text-muted">
          {t("dca.form.successHint")}
        </p>
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-arka-accent hover:underline"
        >
          {t("dca.form.viewBasescan")}
        </a>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="dca-amount">{t("dca.form.amountLabel")}</Label>
          <Input
            id="dca-amount"
            inputMode="numeric"
            placeholder={t("dca.form.amountPlaceholder")}
            value={amountIdr}
            onChange={(e) => setAmountIdr(e.target.value)}
          />
          <p className="mt-1 text-xs text-arka-text-muted">
            {t("dca.form.amountHint")}
          </p>
        </div>

        <div>
          <Label>{t("dca.form.frequencyLabel")}</Label>
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
                {t(INTERVAL_KEYS[p.seconds])}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="dca-swaps">{t("dca.form.swapsLabel")}</Label>
          <Input
            id="dca-swaps"
            inputMode="numeric"
            placeholder={t("dca.form.swapsPlaceholder")}
            value={totalSwaps}
            onChange={(e) => setTotalSwaps(e.target.value)}
          />
          <p className="mt-1 text-xs text-arka-text-muted">
            {t("dca.form.swapsHint")}
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
          {t("dca.form.info")}
        </p>
      </Card>

      <Button onClick={submit} disabled={busy}>
        {busy ? t("dca.form.submitting") : t("dca.form.submit")}
      </Button>
    </div>
  );
}
