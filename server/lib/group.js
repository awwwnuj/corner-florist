// Group bouquets: one link, many friends, one flower (and one line) each.
// Storage layout (one small JSON blob per record, so two friends adding at once never overwrite each other):
//   groups/<id>/meta.json          who it's for, who started it, a hash of the organizer key
//   groups/<id>/stems/<t>-<sid>.json  one friend's flower and line
//   groups/<id>/delivered.json     written once, when the organizer wraps and sends it
import { createHash, randomBytes } from 'node:crypto';

export const MAX_STEMS = 40;
const TYPES = ['rose', 'peony', 'tulip', 'sunflower', 'lavender', 'anemone', 'cosmos', 'ranunculus', 'eucalyptus', 'sweetpea'];
const ALT = new Set(['rose', 'peony', 'tulip', 'sunflower', 'anemone', 'ranunculus']);   // flowers with a second painting
const PAPERS = 'kibsn', RIBBONS = 'isrup';
const ID_RE = /^[a-z0-9]{6,16}$/;

const ABC = 'abcdefghijkmnpqrstuvwxyz23456789';   // 32 characters, so a random byte maps evenly
const rid = n => { let s = ''; for (const b of randomBytes(n)) s += ABC[b % 32]; return s; };
const hash = s => createHash('sha256').update(String(s)).digest('hex');
const sameHash = (secret, h) => !!secret && typeof secret === 'string' && !!h && hash(secret) === h;

// trim, drop control, zero-width and direction-override characters, collapse whitespace, cap by characters (not bytes)
// (tabs and line breaks, 0x09-0x0d, are kept here and become single spaces below)
const HIDDEN = [[0x00, 0x08], [0x0e, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x202a, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff]];
const hidden = ch => { const n = ch.codePointAt(0); return HIDDEN.some(([a, b]) => n >= a && n <= b); };
function clean(v, max) {
  const s = Array.from(String(v ?? '').normalize('NFC')).filter(ch => !hidden(ch)).join('')
    .replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, max).join('');
}

const P = id => `groups/${id}/`;
const fail = (status, error, message) => ({ status, body: { error, message } });

async function load(store, id) {
  const blobs = await store.list(P(id));
  const metaB = blobs.find(b => b.pathname === P(id) + 'meta.json');
  if (!metaB) return null;
  const delB = blobs.find(b => b.pathname === P(id) + 'delivered.json');
  const stemBs = blobs.filter(b => b.pathname.startsWith(P(id) + 'stems/'));
  const [meta, delivered, ...stems] = await Promise.all([store.get(metaB), delB ? store.get(delB) : null, ...stemBs.map(b => store.get(b))]);
  if (!meta) return null;
  return {
    meta, delivered,
    stems: stems.map((s, i) => s && Object.assign({}, s, { _blob: stemBs[i] })).filter(Boolean).sort((a, b) => a.at - b.at || (a.sid < b.sid ? -1 : 1)),
  };
}

function view(g, key) {
  const v = {
    id: g.meta.id, to: g.meta.to, from: g.meta.from, created: g.meta.created, max: MAX_STEMS,
    delivered: g.delivered ? { paper: g.delivered.paper, ribbon: g.delivered.ribbon, seed: g.delivered.seed, to: g.delivered.to, sign: g.delivered.sign, at: g.delivered.at } : null,
    stems: g.stems.map(({ sid, type, vk, flip, name, line, at }) => ({ sid, type, vk, flip, name, line, at })),
  };
  if (key !== undefined) v.admin = sameHash(key, g.meta.keyHash);
  return v;
}

async function create(store, body) {
  const to = clean(body.to, 24), from = clean(body.from, 24);
  if (!to) return fail(400, 'to', 'Who is the bouquet for?');
  if (!from) return fail(400, 'from', 'Add your name so friends know who started it.');
  const id = rid(10), key = rid(22);
  const meta = { v: 1, id, to, from, created: Date.now(), keyHash: hash(key) };
  await store.put(P(id) + 'meta.json', meta);
  return { status: 201, body: { id, key, group: view({ meta, delivered: null, stems: [] }, key) } };
}

async function add(store, id, body) {
  const g = await load(store, id);
  if (!g) return fail(404, 'not_found', 'This group bouquet doesn’t exist.');
  if (g.delivered) return fail(409, 'delivered', 'This bouquet has already been delivered.');
  if (g.stems.length >= MAX_STEMS) return fail(409, 'full', 'This bouquet is full.');
  const type = String(body.type || '');
  if (!TYPES.includes(type)) return fail(400, 'type', 'Pick a flower first.');
  const name = clean(body.name, 24);
  if (!name) return fail(400, 'name', 'Add your name so they know who picked it.');
  const vk = body.vk === type + '2' && ALT.has(type) ? type + '2' : type;
  const sid = rid(8), token = rid(16), at = Date.now();
  const stem = { sid, type, vk, flip: !!body.flip, name, line: clean(body.line, 120), at, tokHash: hash(token) };
  await store.put(`${P(id)}stems/${at.toString(36)}-${sid}.json`, stem);
  g.stems.push(stem);
  return { status: 201, body: { sid, token, group: view(g) } };
}

async function remove(store, id, body) {
  const g = await load(store, id);
  if (!g) return fail(404, 'not_found', 'This group bouquet doesn’t exist.');
  const st = g.stems.find(s => s.sid === body.sid);
  if (!st) return { status: 200, body: { group: view(g) } };   // already gone
  if (!sameHash(body.key, g.meta.keyHash) && !sameHash(body.token, st.tokHash)) return fail(403, 'forbidden', 'Only the organizer or whoever added it can take a flower out.');
  if (g.delivered) return fail(409, 'delivered', 'This bouquet has already been delivered.');
  await store.del(st._blob);
  g.stems = g.stems.filter(s => s !== st);
  return { status: 200, body: { group: view(g) } };
}

async function deliver(store, id, body) {
  const g = await load(store, id);
  if (!g) return fail(404, 'not_found', 'This group bouquet doesn’t exist.');
  if (!sameHash(body.key, g.meta.keyHash)) return fail(403, 'forbidden', 'Only the organizer can deliver it.');
  if (g.delivered) return { status: 200, body: { group: view(g) } };   // delivering twice is harmless
  if (!g.stems.length) return fail(409, 'empty', 'Add at least one flower first.');
  const seed = Math.max(0, Math.min(35, parseInt(body.seed, 10) || 0));
  g.delivered = {
    paper: PAPERS.includes(body.paper) && body.paper.length === 1 ? body.paper : 'k',
    ribbon: RIBBONS.includes(body.ribbon) && body.ribbon.length === 1 ? body.ribbon : 'i',
    seed, to: clean(body.to, 24) || g.meta.to, sign: clean(body.sign, 24) || `${g.stems.length} friend${g.stems.length > 1 ? 's' : ''}`, at: Date.now(),
  };
  await store.put(P(id) + 'delivered.json', g.delivered);
  return { status: 200, body: { group: view(g) } };
}

// GET  ?id=<id>[&key=<organizer key>]
// POST ?a=create              {to, from}
// POST ?id=<id>&a=add         {type, vk, flip, name, line}
// POST ?id=<id>&a=remove      {sid, key | token}
// POST ?id=<id>&a=deliver     {key, paper, ribbon, seed, to, sign}
export async function handle(store, { method, query, body }) {
  const id = String(query.id || ''), a = String(query.a || '');
  if (method === 'POST' && a === 'create') return create(store, body || {});
  if (!ID_RE.test(id)) return fail(400, 'id', 'That link looks incomplete.');
  if (method === 'GET') {
    const g = await load(store, id);
    return g ? { status: 200, body: { group: view(g, query.key) } } : fail(404, 'not_found', 'This group bouquet doesn’t exist.');
  }
  if (method === 'POST' && a === 'add') return add(store, id, body || {});
  if (method === 'POST' && a === 'remove') return remove(store, id, body || {});
  if (method === 'POST' && a === 'deliver') return deliver(store, id, body || {});
  return fail(405, 'method', 'Not supported.');
}
