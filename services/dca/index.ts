/**
 * Future: recurring IDR funding and automated DCA into cbBTC on Base.
 * Implementations will orchestrate treasury, IDRX, and on-chain swaps — not used in v1.
 */
export type DcaScheduleDraft = {
  userId: string;
  amountIdr: string;
  cadence: "weekly" | "monthly";
};

export async function scheduleDeposit(draft: DcaScheduleDraft): Promise<never> {
  void draft;
  throw new Error("DCA is not implemented yet");
}

export async function listSchedules(userId: string): Promise<DcaScheduleDraft[]> {
  void userId;
  return [];
}
