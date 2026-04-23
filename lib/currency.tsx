"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CurrencyCode = "IDR" | "USD";

type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  hydrated: boolean;
  /** Format a numeric amount in the current currency. */
  format: (amount: number, opts?: Intl.NumberFormatOptions) => string;
  /** Short symbol for labels (Rp / $). */
  symbol: string;
};

const STORAGE_KEY = "arka-currency";

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "IDR",
  setCurrency: () => {},
  hydrated: false,
  format: (a: number) => String(a),
  symbol: "Rp",
});

function readInitial(): CurrencyCode {
  if (typeof window === "undefined") return "IDR";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "IDR" || stored === "USD") return stored;
  return "IDR";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("IDR");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCurrencyState(readInitial());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const format = useCallback(
    (amount: number, opts: Intl.NumberFormatOptions = {}) => {
      const locale = currency === "IDR" ? "id-ID" : "en-US";
      const defaults: Intl.NumberFormatOptions =
        currency === "IDR"
          ? { maximumFractionDigits: 0 }
          : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
      const symbol = currency === "IDR" ? "Rp" : "$";
      const body = amount.toLocaleString(locale, { ...defaults, ...opts });
      return currency === "IDR" ? `${symbol} ${body}` : `${symbol}${body}`;
    },
    [currency],
  );

  const symbol = currency === "IDR" ? "Rp" : "$";

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, hydrated, format, symbol }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
