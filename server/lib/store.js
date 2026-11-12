// Two interchangeable stores: Vercel Blob (private) in production, a Map for local testing.
// Every record is written once and never overwritten, so reads can be cached safely.
import { put, list, get, del } from '@vercel/blob';

export function blobStore() {
  return {
    async list(prefix) {
      const out = [];
      let cursor;
      do {
        const r = await list({ prefix, cursor, limit: 1000 });
        r.blobs.forEach(b => out.push({ pathname: b.pathname, url: b.url }));
        cursor = r.hasMore ? r.cursor : undefined;
      } while (cursor);
      return out;
    },
    async get(b) {
      const r = await get(b.pathname, { access: 'private' });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      return JSON.parse(await new Response(r.stream).text());
    },
    async put(pathname, obj) {
      await put(pathname, JSON.stringify(obj), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
    },
    async del(b) { await del(b.url); },
  };
}

export function memoryStore() {
  const m = new Map();
  return {
    async list(prefix) { return [...m.keys()].filter(k => k.startsWith(prefix)).sort().map(k => ({ pathname: k, url: 'mem://' + k })); },
    async get(b) { const v = m.get(b.pathname); return v ? JSON.parse(v) : null; },
    async put(pathname, obj) { if (m.has(pathname)) throw new Error('exists'); m.set(pathname, JSON.stringify(obj)); },
    async del(b) { m.delete(b.pathname); },
  };
}
