export function d1Store(db) {
 return {
  async get(key) { const r=await db.prepare('SELECT value FROM records WHERE key = ?').bind(key).first();return r?JSON.parse(r.value):null; },
  async set(key,value) { await db.prepare('INSERT INTO records(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(value)).run(); },
  async create(key,value) { const r=await db.prepare('INSERT OR IGNORE INTO records(key,value) VALUES (?,?)').bind(key,JSON.stringify(value)).run();return r.meta.changes===1; },
  async del(key) { await db.prepare('DELETE FROM records WHERE key = ?').bind(key).run(); },
  async list(prefix) { const r=await db.prepare('SELECT value FROM records WHERE key >= ? AND key < ?').bind(prefix,prefix+'\uffff').all();return r.results.map(r=>JSON.parse(r.value)); },
  async increment(key) { await db.prepare("INSERT INTO records(key,value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)").bind(key).run(); }
  async incrementAndGet(key) { const r=await db.prepare("INSERT INTO records(key,value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT) RETURNING CAST(value AS INTEGER) AS count").bind(key).first();return Number(r?.count||0); }
 };
}
