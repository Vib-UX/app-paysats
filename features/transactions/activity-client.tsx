"use client";

import { Screen } from "@/components/ui/screen";
import { fetchWithPrivy } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { MintTransaction } from "@/types/transaction";
import { usePrivy } from "@privy-io/react-auth";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TransactionList } from "./transaction-list";

export function ActivityClient() {
  const { getAccessToken, ready, authenticated } = usePrivy();
  const searchParams = useSearchParams();
  const merchantOrderId = searchParams.get("merchantOrderId")?.trim() ?? "";
  const t = useT();
  const [items, setItems] = useState<MintTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const q = new URLSearchParams({ page: "1", take: "20" });
    if (merchantOrderId) q.set("merchantOrderId", merchantOrderId);
    const res = await fetchWithPrivy(
      getAccessToken,
      `/api/idrx/transactions?${q.toString()}`,
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error || t("activity.failedLoad"));
      setItems([]);
      return;
    }
    setItems(j.transactions ?? []);
  }, [getAccessToken, merchantOrderId, t]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, load]);

  return (
    <Screen
      title={t("activity.title")}
      subtitle={t("activity.subtitle")}
    >
      {error ? (
        <p className="mb-4 text-sm text-arka-danger" role="alert">
          {error}
        </p>
      ) : null}
      {items === null ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[var(--radius-card)] bg-arka-border/60"
            />
          ))}
        </div>
      ) : (
        <TransactionList items={items} />
      )}
      <button
        type="button"
        onClick={() => load()}
        className="mt-6 w-full text-center text-sm font-medium text-arka-accent"
      >
        {t("activity.reload")}
      </button>
    </Screen>
  );
}
