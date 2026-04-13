import { ActivityClient } from "@/features/transactions/activity-client";
import { Suspense } from "react";

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        </div>
      }
    >
      <ActivityClient />
    </Suspense>
  );
}
