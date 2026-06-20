export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }
    const url = new URL(request.url);
    const { pathname } = url;
    const tokenFromQuery = url.searchParams.get('token');
    const auth = request.headers.get('Authorization') || (tokenFromQuery ? `Bearer ${tokenFromQuery}` : '');
    if (auth !== `Bearer ${env.API_TOKEN}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
    if (pathname === '/health') {
      return json({ ok: true });
    }
    if (pathname === '/data') {
      if (request.method === 'GET') {
        const raw = await env.EPIGRAPH_KV.get('data');
        if (!raw) return json({ data: null, updatedAt: 0 });
        return json(JSON.parse(raw));
      }
      if (request.method === 'PUT') {
        const body = await request.json();
        await env.EPIGRAPH_KV.put('data', JSON.stringify(body));
        return json({ ok: true });
      }
    }
    if (pathname.startsWith('/pdf/')) {
      const key = decodeURIComponent(pathname.slice(5));
      if (!key) return json({ error: 'Bad Request' }, 400);
      if (request.method === 'GET') {
        const obj = await env.PDF_BUCKET.get(key);
        if (!obj) return json({ error: 'Not Found' }, 404);
        return new Response(obj.body, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${key}"`,
            ...cors()
          }
        });
      }
      if (request.method === 'PUT') {
        const body = await request.arrayBuffer();
        await env.PDF_BUCKET.put(key, body, {
          httpMetadata: { contentType: 'application/pdf' }
        });
        return json({ ok: true });
      }
    }
    return json({ error: 'Not Found' }, 404);
  }
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() }
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Disposition'
  };
}
