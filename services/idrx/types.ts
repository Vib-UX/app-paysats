export type IdrxOnboardingResponse = {
  statusCode: number;
  message: string;
  data?: {
    id: number;
    fullname: string;
    createdAt: string;
    apiKey: string;
    apiSecret: string;
  };
};

export type IdrxMintResponse = {
  statusCode: number;
  message: string;
  data?: {
    id?: string;
    merchantCode?: string;
    reference: string;
    paymentUrl: string;
    amount: string;
    statusCode?: string;
    statusMessage?: string;
    merchantOrderId: string;
  };
};

export type IdrxHistoryRecord = {
  id: number;
  paymentAmount: number;
  merchantOrderId?: string;
  destinationWalletAddress: string;
  toBeMinted: string;
  createdAt: string;
  paymentStatus: string;
  expiryTimestamp?: string;
  reference?: string;
  txHash?: string | null;
  adminMintStatus: string;
  userMintStatus: string;
};

export type IdrxHistoryResponse = {
  statusCode: number;
  message: string;
  metadata?: {
    page: number;
    perPage: number;
    pageCount: number;
    totalCount: number;
  };
  records?: IdrxHistoryRecord[];
};

// ---------------------------------------------------------------------------
// Payout destinations (banks + e-wallets)
// ---------------------------------------------------------------------------

export type IdrxBankAccountRecord = {
  id: number;
  userId?: number;
  bankAccountNumber: string;
  bankAccountName: string;
  bankAccountNumberHash?: string | null;
  bankCode: string;
  bankName: string;
  maxAmountTransfer?: string | null;
  deleted?: boolean;
  DepositWalletAddress?: {
    walletAddress: string;
    createdAt?: string;
  } | null;
};

export type IdrxListBankAccountsResponse = {
  statusCode: number;
  message: string;
  data?: IdrxBankAccountRecord[];
};

export type IdrxAddBankAccountResponse = {
  statusCode: number;
  message: string;
  data?: IdrxBankAccountRecord;
};

export type IdrxDeleteBankAccountResponse = {
  statusCode: number;
  message: string;
  data?: unknown;
};

export type IdrxBankMethod = {
  bankCode: string;
  bankName: string;
  maxAmountTransfer?: string;
};

export type IdrxMethodResponse = {
  statusCode: number;
  message: string;
  data?: IdrxBankMethod[];
};

// ---------------------------------------------------------------------------
// DEPOSIT_REDEEM history records (partner-stablecoin offramp)
// ---------------------------------------------------------------------------

export type IdrxDepositRedeemRecord = {
  id: number;
  address: string;
  transferTxHash: string;
  tokenFrom: string;
  amountFrom: string;
  swapTxHash?: string | null;
  amountTo?: string | null;
  burnTxHash?: string | null;
  status: string; // PROCESSING | SUCCESS | FAILED | ...
  createdAt: string;
  updatedAt: string;
  tokenTo?: string;
  toAddress?: string;
  userId?: number;
  chainId?: number;
  requester?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankAccountNumberHash?: string | null;
  bankCode?: string;
  bankName?: string;
  amountRedeem?: string | null;
  txType?: string;
};

export type IdrxDepositRedeemHistoryResponse = {
  statusCode: number;
  message: string;
  metadata?: {
    page: number | null;
    perPage: number | null;
    pageCount: number | null;
    totalCount: number;
  };
  records?: IdrxDepositRedeemRecord[];
};
