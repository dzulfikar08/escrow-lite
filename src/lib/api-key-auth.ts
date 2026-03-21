async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function authenticateApiKey(
  request: Request,
  db: D1Database
): Promise<{ sellerId: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    return null;
  }

  const keyHash = await sha256(apiKey);

  const result = await db
    .prepare(
      `
      SELECT seller_id
      FROM api_keys
      WHERE key_hash = ?
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      LIMIT 1
      `
    )
    .bind(keyHash)
    .first<{ seller_id: string }>();

  if (!result) {
    return null;
  }

  await db
    .prepare(
      `
      UPDATE api_keys
      SET last_used_at = datetime('now')
      WHERE key_hash = ?
      `
    )
    .bind(keyHash)
    .run();

  return { sellerId: result.seller_id };
}
