export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }
    const { pathname } = new URL(request.url);
    const auth = request.headers.get('Authorization') || '';
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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
  };
}
