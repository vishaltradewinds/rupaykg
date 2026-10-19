import { createDecipheriv } from "node:crypto";

const MAX_PROMPT_BYTES = 16 * 1024;

/**
 * Loads an AES-256-GCM encrypted prompt supplied through runtime secret
 * configuration. Format: v1:<iv-hex>:<auth-tag-hex>:<ciphertext-hex>.
 * Returns undefined on absent or invalid configuration (fail closed).
 *
 * JavaScript strings cannot be reliably zeroized; callers must not claim that
 * assigning null or forcing GC securely wipes plaintext from process memory.
 */
export function loadConfiguredSystemPrompt(): string | undefined {
  const encoded = process.env.RUPAYKG_AI_PROMPT_CIPHERTEXT?.trim();
  const keyHex = process.env.RUPAYKG_AI_PROMPT_KEY_HEX?.trim();
  if (!encoded || !keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) return undefined;

  const parts = encoded.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return undefined;
  const ivHex = parts[1];
  const tagHex = parts[2];
  const ciphertextHex = parts[3];
  if (typeof ivHex !== "string" || typeof tagHex !== "string" || typeof ciphertextHex !== "string"
    || !/^[0-9a-fA-F]{24}$/.test(ivHex) || !/^[0-9a-fA-F]{32}$/.test(tagHex)
    || !/^(?:[0-9a-fA-F]{2})+$/.test(ciphertextHex) || ciphertextHex.length / 2 > MAX_PROMPT_BYTES) {
    return undefined;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
    if (!clear.trim() || Buffer.byteLength(clear, "utf8") > MAX_PROMPT_BYTES) return undefined;
    return clear;
  } catch {
    return undefined;
  }
}
