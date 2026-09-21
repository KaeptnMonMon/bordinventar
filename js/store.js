// IndexedDB-Zugriff, Schema und Migrationen. Kennt keine Oberfläche.

const DATABASE_NAME = 'bordinventar';
const DATABASE_VERSION = 2;

export const STORE_NAMES = ['locations', 'boxes', 'items'];
// Löschvermerke: { id, store, deletedAt }. Ohne sie käme ein gelöschter Datensatz beim nächsten
// Import von einem anderen Gerät zurück.
export const DELETIONS = 'deletions';

const ID_PREFIXES = { locations: 'loc', boxes: 'box', items: 'itm' };

// Pflichtfelder müssen nach trim() nicht leer sein. Defaults füllen fehlende Felder,
// damit jeder gespeicherte Datensatz vollständig ist.
const SCHEMA = {
  locations: {
    required: ['name'],
    defaults: { order: 0, zone: '' },
  },
  boxes: {
    required: ['locationId'],
    defaults: { number: null, label: '', shelf: '' },
  },
  items: {
    required: ['name', 'locationId'],
    defaults: {
      boxId: null, quantity: 0, unit: '', minQuantity: null,
      expiry: '', category: '', note: '', isExample: false,
    },
  },
};

// Jede Migration bringt die Datenbank von Version n-1 auf n. Bestehende
// Migrationen nie ändern, nur neue Versionen anhängen.
const MIGRATIONS = {
  1(database) {
    for (const name of STORE_NAMES) database.createObjectStore(name, { keyPath: 'id' });
  },
  2(database) {
    database.createObjectStore(DELETIONS, { keyPath: 'id' });
  },
};

// Felder, die neben ihrem Standardwert auch null oder einen anderen Typ tragen dürfen.
const NULLABLE = { boxId: 'string', number: 'number', minQuantity: 'number' };

export class StoreError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StoreError';
    this.cause = cause;
  }
}

let database = null;

function describeFailure(cause) {
  if (cause?.name === 'QuotaExceededError') {
    return 'Der Speicher des Geräts ist voll. Bitte Platz schaffen und es erneut versuchen.';
  }
  const detail = cause ? ` (${cause.name}: ${cause.message})` : '';
  return `Der Zugriff auf den lokalen Speicher ist fehlgeschlagen${detail}.`;
}

export function newId(storeName) {
  const prefix = ID_PREFIXES[storeName];
  if (!prefix) throw new StoreError(`Unbekannter Objektspeicher „${storeName}“.`);
  // randomUUID gibt es nur in sicheren Kontexten; beim Test über http im LAN fehlt es.
  const uuid = crypto.randomUUID?.() ??
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${uuid.replaceAll('-', '').slice(0, 12)}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new StoreError('Dieser Browser bietet keinen lokalen Speicher (IndexedDB).'));
      return;
    }
    let request;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (cause) {
      reject(new StoreError(describeFailure(cause), cause));
      return;
    }
    let created = false;
    request.onupgradeneeded = (event) => {
      created = event.oldVersion === 0;
      for (let version = event.oldVersion + 1; version <= event.newVersion; version++) {
        MIGRATIONS[version](request.result, request.transaction);
      }
    };
    request.onsuccess = () => resolve({ opened: request.result, created });
    request.onerror = () => reject(new StoreError(
      'Der lokale Speicher konnte nicht geöffnet werden. Im privaten Modus von Safari ist das nicht möglich.',
      request.error,
    ));
    request.onblocked = () => reject(new StoreError(
      'Der Speicher wird von einem anderen Fenster der App blockiert. Bitte andere Fenster schließen.',
    ));
  });
}

// Führt work(transaction) aus und liefert, was work zurückgibt, sobald die Transaktion
// wirklich abgeschlossen ist. work gibt eine Funktion zurück, die das Ergebnis liest.
function run(storeNames, mode, work) {
  return new Promise((resolve, reject) => {
    if (!database) {
      reject(new StoreError('Der lokale Speicher ist nicht geöffnet.'));
      return;
    }
    let transaction;
    try {
      transaction = database.transaction(storeNames, mode);
    } catch (cause) {
      reject(new StoreError(describeFailure(cause), cause));
      return;
    }
    let readResult;
    transaction.oncomplete = () => resolve(readResult());
    transaction.onerror = () => reject(new StoreError(describeFailure(transaction.error), transaction.error));
    transaction.onabort = () => reject(new StoreError(describeFailure(transaction.error), transaction.error));
    try {
      readResult = work(transaction);
    } catch (cause) {
      transaction.abort();
      reject(cause instanceof StoreError ? cause : new StoreError(describeFailure(cause), cause));
    }
  });
}

function prepareRecord(storeName, record, timestamp) {
  const schema = SCHEMA[storeName];
  if (!schema) throw new StoreError(`Unbekannter Objektspeicher „${storeName}“.`);
  for (const field of schema.required) {
    if (typeof record[field] !== 'string' || record[field].trim() === '') {
      throw new StoreError(`Ein Datensatz in „${storeName}“ braucht das Feld „${field}“.`);
    }
  }
  return {
    ...schema.defaults,
    ...record,
    id: record.id || newId(storeName),
    updatedAt: timestamp,
  };
}

// Schreibt und löscht über mehrere Objektspeicher in einer Transaktion: entweder alles
// oder nichts. Nötig für Kaskaden wie „Stauraum löschen“. Jedes Löschen hinterlässt einen
// Löschvermerk, in derselben Transaktion.
//   puts:    { items: [record, …], boxes: […] }
//   deletes: { items: [id, …] }
// Nur für den Import:
//   tombstones:      Löschvermerke aus einer Sicherung, mit deren eigenem Zeitpunkt
//   clearTombstones: IDs, deren Vermerk fällt, weil eine neuere Fassung den Datensatz zurückbringt
//   keepTimestamps:  updatedAt der Datensätze unverändert übernehmen
// Liefert die geschriebenen Datensätze, in derselben Form wie puts.
export async function commit({ puts = {}, deletes = {}, tombstones = [], clearTombstones = [], keepTimestamps = false }) {
  const timestamp = new Date().toISOString();
  const prepared = {};
  for (const [storeName, records] of Object.entries(puts)) {
    prepared[storeName] = records.map((record) => prepareRecord(
      storeName, record, keepTimestamps && record.updatedAt ? record.updatedAt : timestamp,
    ));
  }
  for (const storeName of Object.keys(deletes)) {
    if (!SCHEMA[storeName]) throw new StoreError(`Unbekannter Objektspeicher „${storeName}“.`);
  }

  const marks = new Map(tombstones.map((mark) => [mark.id, mark]));
  for (const [storeName, ids] of Object.entries(deletes)) {
    for (const id of ids) if (!marks.has(id)) marks.set(id, { id, store: storeName, deletedAt: timestamp });
  }

  const touched = new Set([...Object.keys(prepared), ...Object.keys(deletes)]);
  if (marks.size > 0 || clearTombstones.length > 0) touched.add(DELETIONS);
  if (touched.size === 0) return {};

  return run([...touched], 'readwrite', (transaction) => {
    for (const [storeName, records] of Object.entries(prepared)) {
      for (const record of records) transaction.objectStore(storeName).put(record);
    }
    for (const [storeName, ids] of Object.entries(deletes)) {
      for (const id of ids) transaction.objectStore(storeName).delete(id);
    }
    for (const mark of marks.values()) {
      transaction.objectStore(DELETIONS).put({ ...mark, updatedAt: mark.deletedAt });
    }
    for (const id of clearTombstones) transaction.objectStore(DELETIONS).delete(id);
    return () => prepared;
  });
}

// Übernimmt aus einem fremden Datensatz nur bekannte Felder mit passendem Typ. Liefert null,
// wenn Pflichtfelder fehlen. Für den Import: Was in einer Datei steht, ist nicht vertrauenswürdig.
export function sanitizeRecord(storeName, record) {
  const schema = SCHEMA[storeName];
  if (!schema || typeof record !== 'object' || record === null) return null;
  if (typeof record.id !== 'string' || record.id === '') return null;
  const clean = { id: record.id };
  for (const field of schema.required) {
    if (typeof record[field] !== 'string' || record[field].trim() === '') return null;
    clean[field] = record[field];
  }
  for (const [field, fallback] of Object.entries(schema.defaults)) {
    const value = record[field];
    if (field in NULLABLE) clean[field] = typeof value === NULLABLE[field] && (typeof value !== 'number' || Number.isFinite(value)) ? value : null;
    else if (typeof fallback === 'number') clean[field] = Number.isFinite(value) ? value : fallback;
    else if (typeof fallback === 'boolean') clean[field] = value === true;
    else clean[field] = typeof value === 'string' ? value : fallback;
  }
  clean.updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : '';
  return clean;
}

export async function putRecord(storeName, record) {
  const written = await commit({ puts: { [storeName]: [record] } });
  return written[storeName][0];
}

export function deleteRecord(storeName, id) {
  return commit({ deletes: { [storeName]: [id] } });
}

export function getRecord(storeName, id) {
  return run([storeName], 'readonly', (transaction) => {
    const request = transaction.objectStore(storeName).get(id);
    return () => request.result ?? null;
  });
}

export function getAll(storeName) {
  return run([storeName], 'readonly', (transaction) => {
    const request = transaction.objectStore(storeName).getAll();
    return () => request.result;
  });
}

// Wird nur beim allerersten Start aufgerufen. Feste IDs in seed.json sind Absicht:
// Legen zwei Geräte unabhängig voneinander die Startstruktur an, führt der
// Import später beide Fassungen zusammen, statt jede Kiste doppelt zu erzeugen.
async function loadSeed() {
  const url = new URL('../seed.json', import.meta.url);
  let response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new StoreError('Die Startdaten (seed.json) konnten nicht geladen werden.', cause);
  }
  if (!response.ok) {
    throw new StoreError(`Die Startdaten (seed.json) konnten nicht geladen werden (HTTP ${response.status}).`);
  }
  return response.json();
}

async function seedDatabase() {
  const seed = await loadSeed();
  await commit({ puts: Object.fromEntries(STORE_NAMES.map((name) => [name, seed[name] ?? []])) });
}

function deleteDatabase() {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

// Öffnet die Datenbank und legt beim allerersten Start die Startstruktur an.
// Liefert { seeded } – true, wenn gerade die Startstruktur angelegt wurde.
export async function initStore() {
  if (database) return { seeded: false };
  const { opened, created } = await openDatabase();
  database = opened;
  database.onversionchange = () => { database.close(); database = null; };
  database.onclose = () => { database = null; };

  // iOS räumt Website-Daten sonst nach längerer Nichtnutzung ab. Best effort.
  navigator.storage?.persist?.().catch(() => {});

  if (created) {
    try {
      await seedDatabase();
    } catch (error) {
      // Halbfertig angelegt wäre die Datenbank für immer leer; löschen, damit der
      // nächste Start es erneut versucht.
      database.close();
      database = null;
      await deleteDatabase();
      throw error;
    }
  }
  return { seeded: created };
}

// Jeder Bereich des Schiffsplans ist ein Stauraum. Fehlende werden angelegt, mit fester ID,
// damit zwei Geräte beim Abgleich denselben Stauraum meinen und nicht doppelte erzeugen.
// Ein bereits vorhandener Stauraum für den Bereich (auch mit anderem Namen) genügt.
export async function ensureZoneLocations(zones) {
  const taken = new Set((await getAll('locations')).map((location) => location.zone).filter(Boolean));
  const missing = zones.filter((zone) => !taken.has(zone.id));
  if (missing.length === 0) return 0;
  await commit({
    puts: {
      locations: missing.map((zone) => ({ id: `loc_zone_${zone.id}`, name: zone.label, zone: zone.id })),
    },
  });
  return missing.length;
}
