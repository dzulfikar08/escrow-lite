import type { APIRoute } from 'astro';
import { getAuth } from '@/lib/auth';

export const prerender = false;

export const ALL: APIRoute = async (context) => {
  const env = context.locals.runtime?.env;
  const db = env?.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const secret = env?.BETTER_AUTH_SECRET as string;
  const auth = getAuth(db, secret);

  const { pathname } = context.url;
  const authPath = '/api/auth';
  const action = pathname.slice(authPath.length + 1);

  const response = await auth.handler(
    new Request(context.url, {
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
    })
  );

  return response;
};
