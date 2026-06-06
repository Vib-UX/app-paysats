import { ConnectClient } from "@/features/connect/connect-client";
import { Suspense } from "react";

export const metadata = {
  title: "Hubungkan Agent — PaySats",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>;
}) {
  const { handle } = await searchParams;
  return (
    <Suspense fallback={null}>
      <ConnectClient handle={handle ?? null} />
    </Suspense>
  );
}
