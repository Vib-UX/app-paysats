import { MintForm } from "@/features/mint/mint-form";

/**
 * Jangan gate dengan cookie `privy-id-token` di RSC — token sering hanya ada di
 * sisi klien, sehingga redirect server memicu loop auth ↔ mint.
 * MintForm memakai dompet dari Privy + sync DB via Bearer di API.
 */
export default function MintPage() {
  return <MintForm walletAddress={null} />;
}
