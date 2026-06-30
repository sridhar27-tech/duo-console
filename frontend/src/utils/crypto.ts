/**
 * Gate 2: End-to-End Symmetric AES Encryption
 *
 * Text messages and media URLs are encrypted with CryptoJS AES before
 * they hit the socket. The server only ever sees ciphertext — it routes
 * blobs without decrypting. Only clients holding the same PSK can read.
 *
 * Both clients must agree on the same PSK at connection time.
 */

import CryptoJS from "crypto-js";

/**
 * Encrypt a plaintext string using AES with the supplied PSK.
 * Returns a base-64 ciphertext string safe to JSON-serialize.
 */
export function encryptAES(plaintext: string, psk: string): string {
  return CryptoJS.AES.encrypt(plaintext, psk).toString();
}

/**
 * Decrypt a ciphertext string produced by encryptAES.
 * Returns the original plaintext, or null if decryption fails
 * (wrong key, tampered payload, etc.).
 */
export function decryptAES(cipher: string, psk: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, psk);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return plaintext || null;
  } catch {
    return null;
  }
}
