/**
 * Cryptographic utility functions for signature verification
 *
 * This module provides utilities for creating and verifying HMAC signatures
 * used for webhook signature validation with payment gateways like Midtrans.
 */

/**
 * Create an HMAC SHA512 signature
 *
 * @param key - The secret key for HMAC
 * @param data - The data to sign
 * @returns The hexadecimal signature string
 */
export function createHmacSignature(key: string, data: string): string {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);

  // Import the key for HMAC
  return crypto.subtle
    .importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )
    .then((cryptoKey) => crypto.subtle.sign('HMAC', cryptoKey, messageData))
    .then((signature) => {
      // Convert ArrayBuffer to hex string
      const hashArray = new Uint8Array(signature);
      const hashHex = Array.from(hashArray)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hashHex;
    });
}

/**
 * Create an HMAC SHA512 signature (synchronous version)
 *
 * This is a convenience wrapper that uses the async version internally.
 * Note: This still returns a Promise for consistency.
 *
 * @param key - The secret key for HMAC
 * @param data - The data to sign
 * @returns Promise resolving to the hexadecimal signature string
 */
export async function createHmacSignatureAsync(
  key: string,
  data: string
): Promise<string> {
  return createHmacSignature(key, data);
}

/**
 * Verify an HMAC SHA512 signature
 *
 * @param key - The secret key for HMAC
 * @param data - The data that was signed
 * @param signature - The signature to verify (hex string)
 * @returns Promise resolving to true if signature is valid, false otherwise
 */
export async function verifyHmacSignature(
  key: string,
  data: string,
  signature: string
): Promise<boolean> {
  const expectedSignature = await createHmacSignatureAsync(key, data);

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(expectedSignature, signature);
}

/**
 * Timing-safe string comparison
 *
 * Prevents timing attacks by ensuring comparison time is not dependent
 * on the position of the first differing character.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are equal, false otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Create Midtrans webhook signature
 *
 * Midtrans uses SHA512 with format: orderId + statusCode + grossAmount
 *
 * @param orderId - The order ID
 * @param statusCode - The status code from Midtrans
 * @param grossAmount - The gross amount
 * @param serverKey - The Midtrans server key
 * @returns Promise resolving to the hexadecimal signature string
 */
export async function createMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string
): Promise<string> {
  const data = `${orderId}${statusCode}${grossAmount}`;
  return createHmacSignatureAsync(serverKey, data);
}

/**
 * Verify Midtrans webhook signature
 *
 * @param orderId - The order ID from the webhook
 * @param statusCode - The status code from the webhook
 * @param grossAmount - The gross amount from the webhook
 * @param signature - The signature from the webhook header
 * @param serverKey - The Midtrans server key
 * @returns Promise resolving to true if signature is valid, false otherwise
 */
export async function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signature: string,
  serverKey: string
): Promise<boolean> {
  const expectedSignature = await createMidtransSignature(
    orderId,
    statusCode,
    grossAmount,
    serverKey
  );

  return timingSafeEqual(expectedSignature, signature);
}
