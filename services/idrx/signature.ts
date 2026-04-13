import { createHmac } from "crypto";

function atobPolyfill(str: string): string {
  return Buffer.from(str, "base64").toString("binary");
}

/**
 * IDRX request signing — see https://docs.idrx.co/api/generating-a-signature.md
 */
export function createSignature(
  method: string,
  url: string,
  body: unknown,
  timestamp: string,
  secretKeyBase64: string,
): string {
  const bodyBuffer = Buffer.from(JSON.stringify(body === undefined ? {} : body));
  const secret = atobPolyfill(secretKeyBase64);
  const hmac = createHmac("sha256", Buffer.from(secret, "binary"));
  hmac.update(timestamp);
  hmac.update(method.toUpperCase());
  hmac.update(url);
  hmac.update(bodyBuffer);
  return hmac.digest("base64url");
}
