import { useEffect, useState } from "react";
import type { DailyPoint, DepositoRate } from "@predator_757/bitflation-idr-dca";

export function useHistoricalData() {
  const [btcDaily, setBtcDaily] = useState<DailyPoint[]>([]);
  const [ihsgDaily, setIhsgDaily] = useState<DailyPoint[]>([]);
  const [goldDaily, setGoldDaily] = useState<DailyPoint[]>([]);
  const [depositoRates, setDepositoRates] = useState<DepositoRate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/data/btc-daily.json").then((r) => r.json()),
      fetch("/data/ihsg-daily.json").then((r) => r.json()),
      fetch("/data/gold-idr-daily.json").then((r) => r.json()),
      fetch("/data/deposito-rates.json").then((r) => r.json()),
    ])
      .then(([btc, ihsg, gold, deposito]) => {
        if (cancelled) return;
        setBtcDaily(btc);
        setIhsgDaily(ihsg);
        setGoldDaily(gold);
        setDepositoRates(deposito);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { btcDaily, ihsgDaily, goldDaily, depositoRates, loaded };
}
