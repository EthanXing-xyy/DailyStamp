// 集邮册 storage: everything the app hands you goes in here by itself (IndexedDB, this browser only).
// An entry is {id, date, kind, st?, marks?, image?: Blob, back?: Blob, meta?, added}; stamps that can be drawn again from
// their state keep only the state, works that can't (collages, prints, postcards) keep their picture.
const Album = (() => {
  let dbp = null;
  const listeners = new Set();
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('dailycan', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('album')) r.result.createObjectStore('album', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function store(mode) { const d = await db(); return d.transaction('album', mode).objectStore('album'); }

  /** add (or, with the same id, replace) an entry; keep: leave an existing entry with that id alone */
  async function add(e, { keep = false } = {}) {
    try {
      if (keep && await get(e.id)) return;
      await req((await store('readwrite')).put({ added: Date.now(), ...e }));
      listeners.forEach(f => f(e));
    } catch (err) { console.warn('album', err); }
  }
  async function get(id) { try { return await req((await store('readonly')).get(id)); } catch (e) { return null; } }
  async function all() { try { return await req((await store('readonly')).getAll()); } catch (e) { return []; } }
  async function remove(id) { try { await req((await store('readwrite')).delete(id)); } catch (e) { /* gone already */ } }
  const onChange = f => { listeners.add(f); return () => listeners.delete(f); };
  return { add, get, all, remove, onChange };
})();
