import { createSignature } from "./signature";
import type { IdrxHistoryResponse, IdrxMintResponse, IdrxOnboardingResponse } from "./types";

export function getIdrxBaseUrl(): string {
  const u = process.env.IDRX_API_BASE_URL;
  if (!u) throw new Error("IDRX_API_BASE_URL is not set");
  return u.replace(/\/$/, "");
}

function idrxHeaders(
  method: string,
  fullUrl: string,
  signBody: unknown,
  apiKey: string,
  apiSecretBase64: string,
): HeadersInit {
  const timestamp = String(Math.round(Date.now()));
  const sig = createSignature(method, fullUrl, signBody, timestamp, apiSecretBase64);
  return {
    "Content-Type": "application/json",
    "idrx-api-key": apiKey,
    "idrx-api-sig": sig,
    "idrx-api-ts": timestamp,
  };
}

/** Org-level credentials (env) — onboarding only */
export function getOrgCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.IDRX_ORG_API_KEY;
  const apiSecret = process.env.IDRX_ORG_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("IDRX_ORG_API_KEY and IDRX_ORG_API_SECRET must be set");
  }
  return { apiKey, apiSecret };
}

export async function idrxOnboardingMultipart(params: {
  email: string;
  fullname: string;
  address: string;
  idNumber: string;
  idFile: Blob;
  idFileName: string;
}): Promise<IdrxOnboardingResponse> {
  const base = getIdrxBaseUrl();
  const path = "/api/auth/onboarding";
  const fullUrl = `${base}${path}`;

  const { apiKey, apiSecret } = getOrgCredentials();

  const form = new FormData();
  form.set("email", params.email);
  form.set("fullname", params.fullname);
  form.set("address", params.address);
  form.set("idNumber", params.idNumber);
  form.set("idFile", params.idFile, params.idFileName);

  const signBody = {
    email: params.email,
    fullname: params.fullname,
    address: params.address,
    idNumber: params.idNumber,
  };

  const timestamp = String(Math.round(Date.now()));
  const sig = createSignature("POST", fullUrl, signBody, timestamp, apiSecret);

  const res = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "idrx-api-key": apiKey,
      "idrx-api-sig": sig,
      "idrx-api-ts": timestamp,
    },
    body: form,
  });

  return (await res.json()) as IdrxOnboardingResponse;
}

export async function idrxMintRequest(
  userApiKey: string,
  userSecretBase64: string,
  body: {
    toBeMinted: string;
    destinationWalletAddress: string;
    expiryPeriod: number;
    networkChainId: string;
    requestType?: string;
    productDetails?: string;
  },
): Promise<IdrxMintResponse> {
  const base = getIdrxBaseUrl();
  const path = "/api/transaction/mint-request";
  const fullUrl = `${base}${path}`;
  const payload = {
    toBeMinted: body.toBeMinted,
    destinationWalletAddress: body.destinationWalletAddress,
    expiryPeriod: body.expiryPeriod,
    networkChainId: body.networkChainId,
    requestType: body.requestType ?? "idrx",
    ...(body.productDetails ? { productDetails: body.productDetails } : {}),
  };

  const res = await fetch(fullUrl, {
    method: "POST",
    headers: idrxHeaders("POST", fullUrl, payload, userApiKey, userSecretBase64),
    body: JSON.stringify(payload),
  });

  return (await res.json()) as IdrxMintResponse;
}

export type IdrxUserTransactionHistoryQuery = {
  transactionType?: string;
  page?: number;
  take?: number;
  /** Saring satu order mitra — untuk verifikasi pembayaran */
  merchantOrderId?: string;
  reference?: string;
  paymentStatus?: string;
  userMintStatus?: string;
  orderByDate?: "ASC" | "DESC";
};

/** Urutan query harus stabil — signature memakai full URL persis. */
function buildUserTransactionHistoryPath(q: IdrxUserTransactionHistoryQuery): string {
  const transactionType = q.transactionType ?? "MINT";
  const page = q.page ?? 1;
  const take = q.take ?? 20;
  const parts: string[] = [];
  parts.push(`transactionType=${encodeURIComponent(transactionType)}`);
  if (q.userMintStatus) {
    parts.push(`userMintStatus=${encodeURIComponent(q.userMintStatus)}`);
  }
  if (q.paymentStatus) {
    parts.push(`paymentStatus=${encodeURIComponent(q.paymentStatus)}`);
  }
  if (q.merchantOrderId) {
    parts.push(`merchantOrderId=${encodeURIComponent(q.merchantOrderId)}`);
  }
  if (q.reference) {
    parts.push(`reference=${encodeURIComponent(q.reference)}`);
  }
  if (q.orderByDate) {
    parts.push(`orderByDate=${encodeURIComponent(q.orderByDate)}`);
  }
  parts.push(`page=${encodeURIComponent(String(page))}`);
  parts.push(`take=${encodeURIComponent(String(take))}`);
  return `/api/transaction/user-transaction-history?${parts.join("&")}`;
}

export async function idrxUserTransactionHistory(
  userApiKey: string,
  userSecretBase64: string,
  query: IdrxUserTransactionHistoryQuery = {},
): Promise<IdrxHistoryResponse> {
  const base = getIdrxBaseUrl();
  const path = buildUserTransactionHistoryPath(query);
  const fullUrl = `${base}${path}`;

  const signBody = {};
  const res = await fetch(fullUrl, {
    method: "GET",
    headers: idrxHeaders("GET", fullUrl, signBody, userApiKey, userSecretBase64),
  });

  return (await res.json()) as IdrxHistoryResponse;
}
