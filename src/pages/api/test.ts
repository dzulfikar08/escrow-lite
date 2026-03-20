import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Hello World',
    timestamp: new Date().toISOString(),
    number: 42,
    nested: {
      field: 'value'
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
