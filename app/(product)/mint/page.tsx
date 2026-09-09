import { AddFundsClient } from "@/features/mint/add-funds-client";
import { Suspense } from "react";

export default function MintPage() {
  return (
    <Suspense fallback={null}>
      <AddFundsClient />
    </Suspense>
  );
}
