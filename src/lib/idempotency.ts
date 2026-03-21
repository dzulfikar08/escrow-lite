const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_TTL_HOURS = 48;
const CLEANUP_LIMIT = 100;

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface CachedResponse {
  status: number;
  body: any;
  headers: Record<string, string>;
}

export async function withIdempotency(
  request: Request,
  db: D1Database,
  sellerId: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const idempotencyKey = request.headers.get(IDEMPOTENCY_KEY_HEADER);

  if (!idempotencyKey) {
    return handler();
  }

  db.prepare(`DELETE FROM idempotency_keys WHERE expires_at < datetime('now') LIMIT ?`)
    .bind(CLEANUP_LIMIT)
    .run()
    .catch(() => {});

  const existing = await db
    .prepare(
      'SELECT response_json, expires_at FROM idempotency_keys WHERE key = ? AND seller_id = ?'
    )
    .bind(idempotencyKey, sellerId)
    .first<{ response_json: string; expires_at: string }>();

  if (existing) {
    const expiresAt = new Date(existing.expires_at);
    if (expiresAt > new Date()) {
      const cached: CachedResponse = JSON.parse(existing.response_json);
      return new Response(JSON.stringify(cached.body), {
        status: cached.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Replayed': 'true',
          ...cached.headers,
        },
      });
    }
  }

  const bodyClone = request.clone();
  const bodyText = await bodyClone.text();
  const requestHash = bodyText ? await sha256(bodyText) : null;

  const response = await handler();
  const responseClone = response.clone();
  const responseText = await responseClone.text();

  let responseBody: any;
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = responseText || null;
  }

  const cached: CachedResponse = {
    status: response.status,
    body: responseBody,
    headers: {},
  };

  response.headers.forEach((value, key) => {
    if (['content-type', 'x-request-id'].includes(key.toLowerCase())) {
      cached.headers[key] = value;
    }
  });

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

  db.prepare(
    'INSERT INTO idempotency_keys (key, seller_id, request_hash, response_json, expires_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(idempotencyKey, sellerId, requestHash, JSON.stringify(cached), expiresAt.toISOString())
    .run()
    .catch(() => {});

  return response;
}
