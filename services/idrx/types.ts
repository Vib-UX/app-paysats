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
