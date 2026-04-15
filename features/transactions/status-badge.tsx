"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import { paymentTone, summarizePayment, summarizeMint } from "./status-map";

export function PaymentStatusBadge({ status }: { status: string }) {
  const t = useT();
  return <Badge tone={paymentTone(status)}>{summarizePayment(status, t as (key: string) => string)}</Badge>;
}

export function MintStatusBadge({
  admin,
  user,
}: {
  admin: string;
  user: string;
}) {
  const t = useT();
  const label = summarizeMint(admin, user, t as (key: string) => string);
  const tone =
    admin.includes("MINT") && !admin.includes("NOT")
      ? "success"
      : admin.includes("FAIL") || user.includes("FAIL")
        ? "danger"
        : "info";
  return <Badge tone={tone}>{label}</Badge>;
}
