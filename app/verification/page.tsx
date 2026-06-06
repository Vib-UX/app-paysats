import { VerificationClient } from "@/features/verification/verification-client";
import { Suspense } from "react";

export const metadata = {
  title: "Verifikasi Akses Agent — PaySats",
};

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{
    user_code?: string;
    handle?: string;
    complete?: string;
  }>;
}) {
  const { user_code, handle, complete } = await searchParams;
  return (
    <Suspense fallback={null}>
      <VerificationClient
        userCode={user_code ?? null}
        handle={handle ?? null}
        complete={complete ?? null}
      />
    </Suspense>
  );
}
