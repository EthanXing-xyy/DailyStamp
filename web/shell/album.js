// 集邮册 storage: everything the app hands you goes in here by itself (IndexedDB, this browser only).
// An entry is {id, date, kind, st?, marks?, image?: Blob, back?: Blob, meta?, added}; stamps that can be drawn again from
// their state keep only the state, works that can't (collages, prints, postcards) keep their picture.
const Album = (() => {
  let dbp = null;
  const listeners = new Set();
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('dailystamp', 1);
      let fresh = false;
      r.onupgradeneeded = e => { fresh = e.oldVersion === 0; if (!r.result.objectStoreNames.contains('album')) r.result.createObjectStore('album', { keyPath: 'id' }); };
      r.onsuccess = () => {
        // a newer tab clearing the album (web/boot.js) waits for this one to let go
        r.result.onversionchange = () => { r.result.close(); dbp = null; };
        (fresh ? adopt(r.result) : Promise.resolve()).catch(() => {}).then(() => res(r.result));
      };
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  /** the album used to live in a database called 'dailycan' (from when this was 每日一罐): move its entries over once */
  function adopt(into) {
    return new Promise(done => {
      const o = indexedDB.open('dailycan');
      o.onupgradeneeded = () => o.transaction.abort();       // there was none: don't leave an empty one behind
      o.onerror = () => done();
      o.onsuccess = () => {
        const old = o.result;
        if (!old.objectStoreNames.contains('album')) { old.close(); indexedDB.deleteDatabase('dailycan'); return done(); }
        const g = old.transaction('album', 'readonly').objectStore('album').getAll();
        g.onerror = () => { old.close(); done(); };
        g.onsuccess = () => {
          const t = into.transaction('album', 'readwrite'), st = t.objectStore('album');
          for (const e of g.result) st.put(e);
          t.oncomplete = () => { old.close(); indexedDB.deleteDatabase('dailycan'); done(); };
          t.onerror = t.onabort = () => { old.close(); done(); };
        };
      };
    });
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
