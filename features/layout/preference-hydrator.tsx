"use client";

import { fetchWithPrivy } from "@/lib/api";
import { useCurrency, type CurrencyCode } from "@/lib/currency";
import { isLocale, useLocale } from "@/lib/i18n";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";

/**
 * After login, overlay server-stored locale/currency onto local preferences
 * so language sticks across devices and respects Settings.
 */
export function PreferenceHydrator() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { setLocale } = useLocale();
  const { setCurrency } = useCurrency();
  const applied = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || applied.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithPrivy(getAccessToken, "/api/user/me");
        if (!res.ok || cancelled) return;
        const j = (await res.json().catch(() => ({}))) as {
          localePreference?: string | null;
          currencyPreference?: string | null;
        };
        if (cancelled) return;
        if (isLocale(j.localePreference)) {
          setLocale(j.localePreference);
        }
        if (j.currencyPreference === "IDR" || j.currencyPreference === "USD") {
          setCurrency(j.currencyPreference as CurrencyCode);
        }
        applied.current = true;
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, setLocale, setCurrency]);

  return null;
}
