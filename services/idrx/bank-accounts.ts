import { createSignature } from "./signature";
import { getIdrxBaseUrl } from "./client";
import type {
  IdrxAddBankAccountResponse,
  IdrxDeleteBankAccountResponse,
  IdrxDepositRedeemHistoryResponse,
  IdrxListBankAccountsResponse,
  IdrxMethodResponse,
} from "./types";

function headers(
  method: string,
  fullUrl: string,
  signBody: unknown,
  apiKey: string,
  apiSecretBase64: string,
): HeadersInit {
  const timestamp = String(Math.round(Date.now()));
  const sig = createSignature(
    method,
    fullUrl,
    signBody,
    timestamp,
    apiSecretBase64,
  );
  return {
    "Content-Type": "application/json",
    "idrx-api-key": apiKey,
    "idrx-api-sig": sig,
    "idrx-api-ts": timestamp,
  };
}

/** List the user's currently-registered payout destinations (banks + e-wallets). */
export async function idrxListBankAccounts(
  userApiKey: string,
  userSecretBase64: string,
): Promise<IdrxListBankAccountsResponse> {
  const base = getIdrxBaseUrl();
  const path = "/api/auth/get-bank-accounts";
  const fullUrl = `${base}${path}`;

  const res = await fetch(fullUrl, {
    method: "GET",
    headers: headers("GET", fullUrl, {}, userApiKey, userSecretBase64),
  });

  return (await res.json()) as IdrxListBankAccountsResponse;
}

/**
 * Register a new payout destination. IDRX resolves the holder name and returns
 * a unique DepositWalletAddress on Base.
 *
 * For e-wallets, `bankAccountNumber` must be the mobile number with country
 * code and no separators (e.g. "628123456789"). For banks, it's the plain
 * account number.
 */
export async function idrxAddBankAccount(
  userApiKey: string,
  userSecretBase64: string,
  body: {
    bankCode: string;
    bankAccountNumber: string;
  },
): Promise<IdrxAddBankAccountResponse> {
  const base = getIdrxBaseUrl();
  const path = "/api/auth/add-bank-account";
  const fullUrl = `${base}${path}`;

  const payload = {
    bankCode: body.bankCode,
    bankAccountNumber: body.bankAccountNumber,
  };

  const res = await fetch(fullUrl, {
    method: "POST",
    headers: headers("POST", fullUrl, payload, userApiKey, userSecretBase64),
    body: JSON.stringify(payload),
  });

  return (await res.json()) as IdrxAddBankAccountResponse;
}

/**
 * Remove a payout destination.
 *
 * IDRX quirk: per their official example the HMAC is computed with method
 * string `'GET'` and an empty body, even though the HTTP verb sent is
 * `DELETE`. We mirror that exactly — signing with `'GET'` but sending a
 * `DELETE` request.
 */
export async function idrxDeleteBankAccount(
  userApiKey: string,
  userSecretBase64: string,
  idrxBankId: number | string,
): Promise<IdrxDeleteBankAccountResponse> {
  const base = getIdrxBaseUrl();
  const path = `/api/auth/delete-bank-account/${idrxBankId}`;
  const fullUrl = `${base}${path}`;

  const timestamp = String(Math.round(Date.now()));
  const sig = createSignature(
    "GET",
    fullUrl,
    "",
    timestamp,
    userSecretBase64,
  );

  const res = await fetch(fullUrl, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "idrx-api-key": userApiKey,
      "idrx-api-sig": sig,
      "idrx-api-ts": timestamp,
    },
  });

  return (await res.json()) as IdrxDeleteBankAccountResponse;
}

/** List the catalogue of supported banks + e-wallets (shared across users). */
export async function idrxListBankMethods(
  userApiKey: string,
  userSecretBase64: string,
): Promise<IdrxMethodResponse> {
  const base = getIdrxBaseUrl();
  const path = "/api/transaction/method";
  const fullUrl = `${base}${path}`;

  const res = await fetch(fullUrl, {
    method: "GET",
    headers: headers("GET", fullUrl, {}, userApiKey, userSecretBase64),
  });

  return (await res.json()) as IdrxMethodResponse;
}

/**
 * Fetch DEPOSIT_REDEEM history — the per-user list of partner-stablecoin
 * offramps (USDC→IDR on Base, USDT→IDR on Polygon, etc.).
 */
export async function idrxDepositRedeemHistory(
  userApiKey: string,
  userSecretBase64: string,
  query: {
    page?: number;
    take?: number;
    transferTxHash?: string;
    burnTxHash?: string;
    orderByDate?: "ASC" | "DESC";
  } = {},
): Promise<IdrxDepositRedeemHistoryResponse> {
  const base = getIdrxBaseUrl();
  const parts: string[] = [];
  parts.push(`transactionType=${encodeURIComponent("DEPOSIT_REDEEM")}`);
  parts.push(`page=${encodeURIComponent(String(query.page ?? 1))}`);
  parts.push(`take=${encodeURIComponent(String(query.take ?? 20))}`);
  if (query.transferTxHash) {
    parts.push(
      `transferTxHash=${encodeURIComponent(query.transferTxHash)}`,
    );
  }
  if (query.burnTxHash) {
    parts.push(`burnTxHash=${encodeURIComponent(query.burnTxHash)}`);
  }
  if (query.orderByDate) {
    parts.push(`orderByDate=${encodeURIComponent(query.orderByDate)}`);
  }
  const path = `/api/transaction/user-transaction-history?${parts.join("&")}`;
  const fullUrl = `${base}${path}`;

  const res = await fetch(fullUrl, {
    method: "GET",
    headers: headers("GET", fullUrl, {}, userApiKey, userSecretBase64),
  });

  return (await res.json()) as IdrxDepositRedeemHistoryResponse;
}
