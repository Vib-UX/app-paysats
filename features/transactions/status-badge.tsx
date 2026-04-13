import { Badge } from "@/components/ui/badge";
import { paymentTone, summarizePayment, summarizeMint } from "./status-map";

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge tone={paymentTone(status)}>{summarizePayment(status)}</Badge>;
}

export function MintStatusBadge({
  admin,
  user,
}: {
  admin: string;
  user: string;
}) {
  const label = summarizeMint(admin, user);
  const tone =
    admin.includes("MINT") && !admin.includes("NOT")
      ? "success"
      : admin.includes("FAIL") || user.includes("FAIL")
        ? "danger"
        : "info";
  return <Badge tone={tone}>{label}</Badge>;
}
