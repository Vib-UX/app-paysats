/**
 * Future: Chainlink Automation / keeper-style triggers for DCA and settlement windows.
 * Stub only — no on-chain integration in v1.
 */
export type KeeperJobDraft = {
  name: string;
  userId: string;
};

export async function registerKeeperJob(job: KeeperJobDraft): Promise<never> {
  void job;
  throw new Error("Chainlink automation is not implemented yet");
}
