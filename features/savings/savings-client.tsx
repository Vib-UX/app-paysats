"use client";

import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { useT } from "@/lib/i18n";

export function SavingsClient() {
  const t = useT();
  return (
    <Screen
      title={t("savings.title")}
      subtitle={t("savings.subtitle")}
    >
      <Card className="border-dashed">
        <p className="text-sm leading-relaxed text-arka-text-muted">
          {t("savings.empty")}
        </p>
      </Card>
    </Screen>
  );
}
