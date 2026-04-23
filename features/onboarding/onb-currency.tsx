"use client";

import { GradButton } from "@/components/ui/grad-button";
import { useCurrency, type CurrencyCode } from "@/lib/currency";
import { useT } from "@/lib/i18n";
import { useState } from "react";

export function OnbCurrency({
  onContinue,
  busy,
}: {
  onContinue: (c: CurrencyCode) => void;
  busy?: boolean;
}) {
  const t = useT();
  const { currency } = useCurrency();
  const [sel, setSel] = useState<CurrencyCode>(currency);

  const options: { code: CurrencyCode; label: string }[] = [
    { code: "IDR", label: t("onb.currency.idr") },
    { code: "USD", label: t("onb.currency.usd") },
  ];

  return (
    <div
      className="absolute inset-0 flex flex-col px-7"
      style={{ background: "var(--arka-bg)" }}
    >
      <div className="pt-20">
        <div
          className="text-2xl font-extrabold"
          style={{ color: "var(--arka-text)", letterSpacing: -0.6 }}
        >
          {t("onb.currency.title")}
        </div>
        <div
          className="mt-1.5 text-[13px]"
          style={{ color: "var(--arka-text-faint)" }}
        >
          {t("onb.currency.sub")}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-2">
        {options.map(({ code, label }) => {
          const active = sel === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setSel(code)}
              className="flex items-center justify-between rounded-[16px] p-[18px] transition-[outline-color]"
              style={{
                background: "var(--arka-surface)",
                boxShadow: "var(--arka-shadow-card)",
                outline: active
                  ? "2px solid var(--arka-accent)"
                  : "2px solid transparent",
              }}
            >
              <span
                className="text-base font-bold"
                style={{ color: "var(--arka-text)" }}
              >
                {label}
              </span>
              <span
                className="rounded-[8px] px-2.5 py-1 text-[11px] font-bold"
                style={{
                  color: "var(--arka-text-faint)",
                  background: "var(--arka-surface-muted)",
                }}
              >
                {code}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pb-10">
        <GradButton
          onClick={() => onContinue(sel)}
          disabled={busy}
        >
          {t("onb.currency.continue")}
        </GradButton>
      </div>
    </div>
  );
}
