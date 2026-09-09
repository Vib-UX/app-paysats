"use client";

import { GradButton } from "@/components/ui/grad-button";
import { useT } from "@/lib/i18n";

export function OnbStacksFund({
  onContinue,
  onSkip,
  busy,
}: {
  onContinue: () => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  const t = useT();

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
          {t("onb.stacksFund.title")}
        </div>
        <div
          className="mt-1.5 text-[13px]"
          style={{ color: "var(--paysats-text-faint)" }}
        >
          {t("onb.stacksFund.sub")}
        </div>
      </div>

      <div className="mt-auto space-y-2.5 pb-10">
        <GradButton onClick={onContinue} disabled={busy}>
          {t("onb.stacksFund.continue")}
        </GradButton>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="w-full rounded-[14px] py-3.5 text-[13px] font-bold"
          style={{ color: "var(--paysats-text-muted)" }}
        >
          {t("onb.stacksFund.skip")}
        </button>
      </div>
    </div>
  );
}
