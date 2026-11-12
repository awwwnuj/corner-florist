// Local preview: serves the site from the repo root and the group API from memory.
//   node server/dev.mjs            -> http://localhost:8787
//   LATENCY=600 node server/dev.mjs  adds a delay to every API call
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './lib/group.js';
import { memoryStore } from './lib/store.js';
import { corsHeaders, readBody } from './lib/http.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = memoryStore();
const port = +process.env.PORT || 8787, latency = +process.env.LATENCY || 0;
const TYPES = { '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/group') {
    Object.entries(corsHeaders(req.headers.origin)).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (latency) await new Promise(r => setTimeout(r, latency));
    const body = req.method === 'POST' ? await readBody(req) : {};
    const out = await handle(store, { method: req.method, query: Object.fromEntries(url.searchParams), body });
    res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(out.body));
  }
  let p = path.join(root, decodeURIComponent(url.pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log(`Corner Florist dev server on http://localhost:${port}`));
