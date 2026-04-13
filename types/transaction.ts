export type MintSettlementInfo = {
  paymentComplete: boolean;
  mintComplete: boolean;
  summary: string;
};

export type MintTransaction = {
  id: string;
  paymentAmount: number;
  toBeMinted: string;
  destinationWalletAddress: string;
  paymentStatus: string;
  adminMintStatus: string;
  userMintStatus: string;
  reference?: string;
  merchantOrderId?: string;
  createdAt: string;
  txHash?: string | null;
  expiryTimestamp?: string | null;
  /** Dari API Arka setelah cek status IDRX */
  settlement?: MintSettlementInfo;
};
