import { StacksClient } from "@/features/stacks/stacks-client";
import { Suspense } from "react";

export default function StacksPage() {
  return (
    <Suspense fallback={null}>
      <StacksClient />
    </Suspense>
  );
}
