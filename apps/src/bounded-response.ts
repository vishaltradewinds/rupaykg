import { createHash } from "node:crypto";

export class ResponseBodyTooLargeError extends Error {
  constructor() {
    super("Response body exceeds the configured size limit");
    this.name = "ResponseBodyTooLargeError";
  }
}

export interface BoundedResponseBody {
  text: string;
  sha256: string;
  bytes: number;
}

/** Read a response body without allowing an untrusted provider to allocate unbounded memory. */
export async function readBoundedResponseBody(response: Response, maxBytes: number): Promise<BoundedResponseBody> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  const declaredLength = response.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new ResponseBodyTooLargeError();
  }

  if (!response.body) {
    return {
      text: "",
      sha256: createHash("sha256").update("").digest("hex"),
      bytes: 0,
    };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  const digest = createHash("sha256");
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ResponseBodyTooLargeError();
      }
      chunks.push(value);
      digest.update(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  } finally {
    reader.releaseLock();
  }

  const joined = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), bytes);
  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(joined),
    sha256: digest.digest("hex"),
    bytes,
  };
}
