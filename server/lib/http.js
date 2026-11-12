// CORS and body parsing shared by the Vercel function and the local dev server.
// The site posts JSON as text/plain, which browsers send without a preflight round trip.
const ALLOWED = (process.env.ALLOWED_ORIGINS || 'https://awwwnuj.github.io,https://rupam870.github.io').split(',').map(s => s.trim()).filter(Boolean);
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function corsHeaders(origin) {
  const h = { 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  const ok = origin && (ALLOWED.includes('*') || ALLOWED.includes(origin) || LOCAL.test(origin));
  if (ok) Object.assign(h, {
    'Access-Control-Allow-Origin': ALLOWED.includes('*') ? '*' : origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });
  return h;
}

export async function readBody(req) {
  let b = req.body;
  if (b === undefined) {
    const chunks = [];
    let size = 0;
    for await (const c of req) { size += c.length; if (size > 16384) return {}; chunks.push(c); }
    b = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') { try { b = b ? JSON.parse(b) : {}; } catch { b = {}; } }
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
}
