import { Buffer } from "node:buffer";

/** 1×1 PNG — IDRX multipart membutuhkan file; isi non-KYC memakai placeholder. */
const BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function placeholderIdPngBlob(): Blob {
  return new Blob([Buffer.from(BASE64, "base64")], { type: "image/png" });
}
