"use client";

import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { useT } from "@/lib/i18n";
import Link from "next/link";

export function OnboardingPlaceholder() {
  const t = useT();
  return (
    <Screen
      title={t("onboarding.title")}
      subtitle={t("onboarding.subtitle")}
    >
      <Card className="space-y-4">
        <p className="text-sm leading-relaxed text-arka-text-muted">
          {t("onboarding.desc")}
        </p>
        <Link
          href="/mint"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-arka-accent px-4 text-sm font-medium text-white transition hover:bg-arka-accent-muted"
        >
          {t("onboarding.goDeposit")}
        </Link>
      </Card>
    </Screen>
  );
}
