import { blobStore } from '../lib/store.js';
import { handle } from '../lib/group.js';
import { corsHeaders, readBody } from '../lib/http.js';

const store = blobStore();

export default async function handler(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  try {
    const url = new URL(req.url, 'http://x');
    const query = Object.fromEntries(url.searchParams);
    const body = req.method === 'POST' ? await readBody(req) : {};
    const out = await handle(store, { method: req.method, query, body });
    res.statusCode = out.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(out.body));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'server', message: 'The florist dropped something. Try again in a moment.' }));
  }
}
