import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const sellerId = url.searchParams.get('seller_id');
  const theme = url.searchParams.get('theme') || 'light';
  const accentColor = url.searchParams.get('accent_color') || '';
  const width = url.searchParams.get('width') || '320';
  const height = url.searchParams.get('height') || '180';

  if (!sellerId) {
    return new Response('// Error: seller_id is required', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  const origin = url.origin;

  const params = new URLSearchParams({ seller_id: sellerId });
  if (theme) params.set('theme', theme);
  if (accentColor) params.set('accent_color', accentColor);

  const iframeSrc = `${origin}/badge/iframe?${params.toString()}`;

  const js = `(function(){
  var d=document,s=d.createElement('script'),c=d.currentScript||d.scripts[d.scripts.length-1],p=c.parentNode;
  var w='${width}',h='${height}';
  var f=d.createElement('iframe');
  f.src='${iframeSrc}';
  f.width=w;f.height=h;f.frameBorder=0;f.style.border='none';f.style.display='block';f.title='Escrow Lite Trust Badge';
  f.setAttribute('loading','lazy');
  if(c.nextSibling){p.insertBefore(f,c.nextSibling)}else{p.appendChild(f)}
})();`;

  return new Response(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
