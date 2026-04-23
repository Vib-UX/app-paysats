"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type DisplayUnit = "SATS" | "BTC";

type DisplayUnitContextValue = {
  unit: DisplayUnit;
  setUnit: (u: DisplayUnit) => void;
  hydrated: boolean;
  /** Format a sats amount in the current unit, returning the numeric body only (no trailing unit label). */
  format: (sats: number | null) => string;
  /** "sats" or "BTC" — use next to the formatted number for display. */
  label: string;
};

const STORAGE_KEY = "arka-display-unit";

const DisplayUnitContext = createContext<DisplayUnitContextValue>({
  unit: "SATS",
  setUnit: () => {},
  hydrated: false,
  format: (s: number | null) => (s == null ? "—" : s.toLocaleString()),
  label: "sats",
});

function readInitial(): DisplayUnit {
  if (typeof window === "undefined") return "SATS";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "SATS" || stored === "BTC") return stored;
  return "SATS";
}

export function DisplayUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<DisplayUnit>("SATS");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnitState(readInitial());
    setHydrated(true);
  }, []);

  const setUnit = useCallback((u: DisplayUnit) => {
    setUnitState(u);
    try {
      window.localStorage.setItem(STORAGE_KEY, u);
    } catch {
      /* ignore */
    }
  }, []);

  const format = useCallback(
    (sats: number | null) => {
      if (sats == null || !Number.isFinite(sats)) return "—";
      if (unit === "BTC") {
        const btc = sats / 1e8;
        // Trim trailing zeros for readability but keep up to 8 decimals
        return btc.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 8,
        });
      }
      return Math.round(sats).toLocaleString();
    },
    [unit],
  );

  const label = unit === "BTC" ? "BTC" : "sats";

  return (
    <DisplayUnitContext.Provider
      value={{ unit, setUnit, hydrated, format, label }}
    >
      {children}
    </DisplayUnitContext.Provider>
  );
}

export function useDisplayUnit() {
  return useContext(DisplayUnitContext);
}
