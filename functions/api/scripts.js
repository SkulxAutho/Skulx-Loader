// Skulx Script Vault — Cloudflare Pages Function
// Route: /api/scripts

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function getAll(env) {
  const list = await env.SKULX_DB.list({ prefix: 'script:' });
  const items = await Promise.all(
    list.keys.map(k => env.SKULX_DB.get(k.name, { type: 'json' }))
  );
  return items.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
}

export async function onRequest({ request, env }) {
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // /api/scripts        → no id
  // /api/scripts/:id    → has id
  const id = pathParts[2] || null;

  // GET /api/scripts — fetch all
  if (method === 'GET' && !id) {
    const scripts = await getAll(env);
    return json(scripts);
  }

  // POST /api/scripts — create
  if (method === 'POST' && !id) {
    const body = await request.json();
    const { title, author, code } = body;
    if (!title || !code) return json({ error: 'Missing fields' }, 400);
    const script = {
      id: uid(),
      title: String(title).slice(0, 120),
      author: String(author || 'Anonymous').slice(0, 60),
      code: String(code).slice(0, 50000),
      likes: 0,
      dislikes: 0,
      createdAt: Date.now(),
    };
    await env.SKULX_DB.put('script:' + script.id, JSON.stringify(script));
    return json(script, 201);
  }

  // PUT /api/scripts/:id — edit or react
  if (method === 'PUT' && id) {
    const existing = await env.SKULX_DB.get('script:' + id, { type: 'json' });
    if (!existing) return json({ error: 'Not found' }, 404);
    const body = await request.json();

    // reaction: { action: 'like' | 'dislike' | 'unlike' | 'undislike' }
    if (body.action) {
      if (body.action === 'like')       existing.likes    = Math.max(0, existing.likes + 1);
      if (body.action === 'unlike')     existing.likes    = Math.max(0, existing.likes - 1);
      if (body.action === 'dislike')    existing.dislikes = Math.max(0, existing.dislikes + 1);
      if (body.action === 'undislike')  existing.dislikes = Math.max(0, existing.dislikes - 1);
    } else {
      // full edit
      if (body.title)  existing.title  = String(body.title).slice(0, 120);
      if (body.author) existing.author = String(body.author).slice(0, 60);
      if (body.code)   existing.code   = String(body.code).slice(0, 50000);
      existing.updatedAt = Date.now();
    }

    await env.SKULX_DB.put('script:' + id, JSON.stringify(existing));
    return json(existing);
  }

  // DELETE /api/scripts/:id
  if (method === 'DELETE' && id) {
    await env.SKULX_DB.delete('script:' + id);
    return json({ deleted: true });
  }

  return json({ error: 'Not found' }, 404);
}
  
