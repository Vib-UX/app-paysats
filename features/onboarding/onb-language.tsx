"use client";

import { GradButton } from "@/components/ui/grad-button";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { useState } from "react";

export function OnbLanguage({
  onContinue,
  busy,
}: {
  onContinue: (l: Locale) => void;
  busy?: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [sel, setSel] = useState<Locale>(locale === "id" ? "id" : "en");

  const options: { code: Locale; label: string }[] = [
    { code: "en", label: t("onb.language.en") },
    { code: "id", label: t("onb.language.id") },
  ];

  return (
    <div
      className="absolute inset-0 flex flex-col px-7"
      style={{ background: "var(--paysats-bg)" }}
    >
      <div className="pt-20">
        <div
          className="text-2xl font-extrabold"
          style={{ color: "var(--paysats-text)", letterSpacing: -0.6 }}
        >
          {t("onb.language.title")}
        </div>
        <div
          className="mt-1.5 text-[13px]"
          style={{ color: "var(--paysats-text-faint)" }}
        >
          {t("onb.language.sub")}
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
                background: "var(--paysats-surface)",
                boxShadow: "var(--paysats-shadow-card)",
                outline: active
                  ? "2px solid var(--paysats-accent)"
                  : "2px solid transparent",
              }}
            >
              <span
                className="text-base font-bold"
                style={{ color: "var(--paysats-text)" }}
              >
                {label}
              </span>
              <span
                className="rounded-[8px] px-2.5 py-1 text-[11px] font-bold uppercase"
                style={{
                  color: "var(--paysats-text-faint)",
                  background: "var(--paysats-surface-muted)",
                }}
              >
                {code}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pb-10">
        <GradButton onClick={() => onContinue(sel)} disabled={busy}>
          {t("onb.language.continue")}
        </GradButton>
      </div>
    </div>
  );
}
