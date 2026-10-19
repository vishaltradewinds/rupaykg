#!/usr/bin/env node
import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const file = process.argv[2];
const keyHex = process.env.RUPAYKG_AI_PROMPT_KEY_HEX?.trim();
if (!file || !keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
  console.error("Usage: RUPAYKG_AI_PROMPT_KEY_HEX=<64-hex-char-key> node scripts/encrypt-ai-prompt.mjs <private-prompt-file>");
  process.exit(2);
}
const plaintext = readFileSync(file);
if (!plaintext.length || plaintext.length > 16 * 1024) {
  console.error("Prompt must be between 1 byte and 16 KiB.");
  process.exit(2);
}
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
process.stdout.write(`v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}\n`);
