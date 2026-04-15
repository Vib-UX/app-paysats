"use client";

import { Card } from "@/components/ui/card";
import { useLocale, useT } from "@/lib/i18n";
import type { MintTransaction } from "@/types/transaction";
import { MintStatusBadge, PaymentStatusBadge } from "./status-badge";

function shortenAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function TransactionList({ items }: { items: MintTransaction[] }) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";

  if (items.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-arka-text-muted">
          {t("tx.empty")}
        </p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((tx) => (
        <li key={tx.id}>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <PaymentStatusBadge status={tx.paymentStatus} />
              <MintStatusBadge
                admin={tx.adminMintStatus}
                user={tx.userMintStatus}
              />
            </div>
            {tx.settlement ? (
              <p className="text-sm font-medium text-arka-text">
                {tx.settlement.summary}
              </p>
            ) : null}
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">{t("tx.amountIdrx")}</dt>
                <dd className="font-medium">Rp {tx.toBeMinted}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">{t("tx.payIdr")}</dt>
                <dd className="font-medium">
                  Rp {tx.paymentAmount.toLocaleString(localeStr)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">{t("tx.destWallet")}</dt>
                <dd className="font-mono text-xs">
                  {shortenAddr(tx.destinationWalletAddress)}
                </dd>
              </div>
              {tx.reference ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-arka-text-muted">{t("tx.reference")}</dt>
                  <dd className="max-w-[55%] truncate font-mono text-xs">
                    {tx.reference}
                  </dd>
                </div>
              ) : null}
              {tx.merchantOrderId ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-arka-text-muted">{t("tx.merchantOrder")}</dt>
                  <dd className="font-mono text-xs">{tx.merchantOrderId}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">{t("tx.createdAt")}</dt>
                <dd className="text-xs text-arka-text-muted">
                  {new Date(tx.createdAt).toLocaleString(localeStr)}
                </dd>
              </div>
              {tx.txHash ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-arka-text-muted">{t("tx.txHash")}</dt>
                  <dd className="max-w-[60%] truncate font-mono text-xs">
                    {tx.txHash}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}
