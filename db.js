/* Offline persistence. Packaged Mac and iOS builds store the same JSON document
 * in a local SQLite table; normal browsers use IndexedDB for easy development. */
const STORE_KEY = 'makeover_pos_state_v1';

export const defaultServices = [
  { id: crypto.randomUUID(), name: 'Haircut & Styling', price: 500 },
  { id: crypto.randomUUID(), name: 'Facial & Glow Treatment', price: 1500 },
  { id: crypto.randomUUID(), name: 'Bridal Makeup', price: 10000 },
  { id: crypto.randomUUID(), name: 'Party Makeup', price: 2500 },
  { id: crypto.randomUUID(), name: 'Hair Spa', price: 1200 },
  { id: crypto.randomUUID(), name: 'Manicure & Pedicure', price: 900 }
];

export function freshState() { return { version: 1, services: defaultServices, customers: {}, sales: [] }; }

class IndexedDbStore {
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('makeover-pos', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('state');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async get(key) { const d = await this.open(); return new Promise((resolve, reject) => { const r = d.transaction('state').objectStore('state').get(key); r.onsuccess = () => resolve(r.result ?? null); r.onerror = () => reject(r.error); }); }
  async set(key, value) { const d = await this.open(); return new Promise((resolve, reject) => { const r = d.transaction('state', 'readwrite').objectStore('state').put(value, key); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); }); }
}

class ElectronSqliteStore {
  get(key) { return window.makeoverDesktop.get(key); }
  set(key, value) { return window.makeoverDesktop.set(key, value); }
}

class CapacitorSqliteStore {
  constructor(plugin) { this.plugin = plugin; this.connection = null; }
  async ready() {
    if (this.connection) return;
    const name = 'makeover_pos';
    const consistency = await this.plugin.checkConnectionsConsistency({ dbNames: [name], openModes: ['no-encryption'] });
    this.connection = consistency.result ? await this.plugin.retrieveConnection({ database: name, readonly: false }) : await this.plugin.createConnection({ database: name, version: 1, encrypted: false, mode: 'no-encryption', readonly: false });
    await this.connection.open();
    await this.connection.execute('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  }
  async get(key) { await this.ready(); const r = await this.connection.query('SELECT value FROM app_state WHERE key = ?', [key]); return r.values?.[0]?.value ?? null; }
  async set(key, value) { await this.ready(); await this.connection.run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [key, value]); }
}

function nativePlugin() { return window.Capacitor?.Plugins?.CapacitorSQLite; }

export async function createDatabase() {
  const store = window.makeoverDesktop ? new ElectronSqliteStore() : nativePlugin() ? new CapacitorSqliteStore(nativePlugin()) : new IndexedDbStore();
  let raw = await store.get(STORE_KEY);
  if (!raw) {
    // One-time import from the original browser-only POS.
    const legacyServices = localStorage.getItem('salon_services');
    const legacyCustomers = localStorage.getItem('salon_customers');
    const legacySales = localStorage.getItem('salon_sales');
    const state = legacyServices || legacyCustomers || legacySales ? {
      version: 1,
      services: JSON.parse(legacyServices || 'null') || defaultServices,
      customers: JSON.parse(legacyCustomers || '{}'),
      sales: JSON.parse(legacySales || '[]')
    } : freshState();
    raw = JSON.stringify(state); await store.set(STORE_KEY, raw);
  }
  return {
    platform: window.makeoverDesktop ? 'macOS SQLite' : nativePlugin() ? 'iOS SQLite' : 'browser IndexedDB',
    async read() { return JSON.parse(await store.get(STORE_KEY)); },
    async write(state) { await store.set(STORE_KEY, JSON.stringify(state)); },
    async exportBackup() { return await store.get(STORE_KEY); },
    async restoreBackup(text) { const data = JSON.parse(text); if (!Array.isArray(data.services) || !Array.isArray(data.sales) || typeof data.customers !== 'object') throw new Error('This is not a Makeover POS backup.'); await store.set(STORE_KEY, JSON.stringify(data)); }
  };
}
