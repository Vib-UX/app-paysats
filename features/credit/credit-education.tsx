"use client";

import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { useState } from "react";

const STEPS = [
  { icon: "🔒", key: "credit.learn1" },
  { icon: "💵", key: "credit.learn2" },
  { icon: "✅", key: "credit.learn3" },
  { icon: "🛡️", key: "credit.learn4" },
] as const;

export function CreditEducation() {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mt-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-sm font-medium text-paysats-text">
          {t("credit.learnTitle")}
        </span>
        <span
          className="text-xs text-paysats-text-muted transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paysats-surface-muted text-base">
                {step.icon}
              </span>
              <p className="text-sm text-paysats-text">
                {t(step.key as Parameters<typeof t>[0])}
              </p>
            </div>
          ))}
          <p className="rounded-lg bg-amber-50/60 p-3 text-xs leading-relaxed text-paysats-text-muted">
            {t("credit.learnSafetyNote")}
          </p>
        </div>
      )}
    </Card>
  );
}
