// Austausch: Sicherung als JSON, CSV und HTML sowie der zusammenführende Import.

import * as store from './store.js';
import { buildBackupPage, EMBEDDED_ID } from './backup-page.js';
import { formatQuantity, todayIso } from './model.js';

export const FORMAT = 'bordinventar';
export const FORMAT_VERSION = 1;
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const NOT_A_BACKUP = 'Die Datei ist keine Bordinventar-Sicherung.';

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

export async function collectData() {
  const names = [...store.STORE_NAMES, store.DELETIONS];
  const [locations, boxes, items, deletions] = await Promise.all(names.map(store.getAll));
  return { locations, boxes, items, deletions };
}

/* ---------- CSV ---------- */

// Semikolon-getrennt, mit BOM, damit Numbers und Excel die Umlaute richtig lesen.
export function buildCsv({ locations, boxes, items }) {
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const boxById = new Map(boxes.map((box) => [box.id, box]));

  const rows = items.map((item) => {
    const box = item.boxId ? boxById.get(item.boxId) : null;
    const section = box && box.number == null;
    return {
      Artikel: item.name,
      Anzahl: formatQuantity(item.quantity),
      Einheit: item.unit ?? '',
      Mindestbestand: item.minQuantity == null ? '' : formatQuantity(item.minQuantity),
      Stauraum: locationById.get(item.locationId)?.name ?? '',
      Kiste: box && !section ? box.number ?? '' : '',
      Regal: box && !section ? box.shelf ?? '' : '',
      Beschriftung: box && !section ? box.label ?? '' : '',
      Unterteilung: section ? box.label ?? '' : '',
      Kategorie: item.category ?? '',
      Ablauf: item.expiry ?? '',
      Notiz: item.note ?? '',
    };
  }).sort((a, b) => collator.compare(a.Stauraum, b.Stauraum)
    || (Number(a.Kiste) || 9999) - (Number(b.Kiste) || 9999)
    || collator.compare(a.Unterteilung, b.Unterteilung)
    || collator.compare(a.Artikel, b.Artikel));

  const columns = ['Artikel', 'Anzahl', 'Einheit', 'Mindestbestand', 'Stauraum', 'Kiste', 'Regal', 'Beschriftung', 'Unterteilung', 'Kategorie', 'Ablauf', 'Notiz'];
  const cell = (value) => {
    let text = String(value ?? '');
    // Tabellenprogramme führen Zellen, die mit = + - @ beginnen, als Formel aus.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `\uFEFF${[columns.join(';'), ...rows.map((row) => columns.map((column) => cell(row[column])).join(';'))].join('\r\n')}`;
}

/* ---------- Ausgabe ---------- */

// Datum und Uhrzeit im Namen, damit sich Sicherungen nicht verwechseln lassen. Nach Name sortiert
// ist auch nach Zeit sortiert.
export function fileStamp(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${todayIso(now)}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function buildExports(data, now = new Date()) {
  const day = fileStamp(now);
  const payload = { format: FORMAT, version: FORMAT_VERSION, exportedAt: now.toISOString(), ...data };
  return {
    json: { name: `Bordinventar-${day}.json`, mime: 'application/json', text: JSON.stringify(payload, null, 1) },
    html: { name: `Bordinventar-Sicherung-${day}.html`, mime: 'text/html', text: buildBackupPage(payload) },
    csv: { name: `Bordinventar-${day}.csv`, mime: 'text/csv', text: buildCsv(data) },
  };
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 2000);
}

// Muss direkt im Tipp-Ereignis aufgerufen werden, ohne vorheriges await: iOS öffnet das
// Teilen-Menü nur dann. Deshalb liegen die Dateien schon fertig vor, wenn das Menü aufgeht.
// Liefert 'shared', 'downloaded' oder 'cancelled'.
export async function deliverFile({ name, mime, text }) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const shareData = { files: [new File([blob], name, { type: blob.type })], title: name };
  // Am Telefon ist das Teilen-Menü („In Dateien sichern“) der natürliche Weg, am Mac der Download.
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob, name);
  return 'downloaded';
}

/* ---------- Import ---------- */

function extractEmbedded(page) {
  const marker = page.indexOf(`id="${EMBEDDED_ID}"`);
  if (marker < 0) throw new Error(NOT_A_BACKUP);
  const start = page.indexOf('>', marker) + 1;
  const end = page.indexOf('</script>', start);
  if (start === 0 || end < 0) throw new Error(NOT_A_BACKUP);
  return page.slice(start, end);
}

// Nimmt die JSON-Sicherung oder die HTML-Sicherung (daraus werden die eingebetteten Daten gelesen).
export function parseBackup(text) {
  const source = text.trimStart().startsWith('<') ? extractEmbedded(text) : text;
  let payload;
  try {
    payload = JSON.parse(source);
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (payload?.format !== FORMAT) throw new Error(NOT_A_BACKUP);
  if (!(payload.version <= FORMAT_VERSION)) {
    throw new Error('Die Sicherung stammt aus einer neueren Fassung der App. Bitte zuerst die App aktualisieren.');
  }
  return payload;
}

const asArray = (value) => (Array.isArray(value) ? value : []);

// Zusammenführen statt ersetzen. Je Datensatz entscheidet das jüngste Ereignis – Änderung oder
// Löschung, lokal oder aus der Sicherung –, bei Gleichstand bleibt der lokale Stand. ISO-Zeitstempel
// lassen sich als Text vergleichen. Rein rechnerisch: schreibt nichts.
export function planMerge(local, payload) {
  const stats = { added: 0, changed: 0, removed: 0, unchanged: 0, skipped: 0 };
  const plan = { puts: {}, deletes: {}, tombstones: [], clearTombstones: [], stats };
  const fallbackStamp = typeof payload.exportedAt === 'string' ? payload.exportedAt : '';

  const events = new Map();
  const add = (id, event) => {
    if (!events.has(id)) events.set(id, []);
    events.get(id).push(event);
  };

  for (const name of store.STORE_NAMES) {
    for (const record of local[name]) add(record.id, { side: 'local', kind: 'record', store: name, at: record.updatedAt ?? '', record });
  }
  for (const mark of local.deletions) add(mark.id, { side: 'local', kind: 'deleted', store: mark.store, at: mark.deletedAt ?? '', mark });

  for (const name of store.STORE_NAMES) {
    for (const raw of asArray(payload[name])) {
      const record = store.sanitizeRecord(name, raw);
      if (!record) {
        stats.skipped++;
        continue;
      }
      record.updatedAt ||= fallbackStamp;
      add(record.id, { side: 'incoming', kind: 'record', store: name, at: record.updatedAt, record });
    }
  }
  for (const raw of asArray(payload.deletions)) {
    const valid = raw && typeof raw.id === 'string' && store.STORE_NAMES.includes(raw.store) && typeof raw.deletedAt === 'string';
    if (!valid) {
      stats.skipped++;
      continue;
    }
    const mark = { id: raw.id, store: raw.store, deletedAt: raw.deletedAt };
    add(mark.id, { side: 'incoming', kind: 'deleted', store: mark.store, at: mark.deletedAt, mark });
  }

  for (const [id, list] of events) {
    const winner = list.reduce((best, event) => (
      event.at > best.at || (event.at === best.at && event.side === 'local' && best.side !== 'local') ? event : best));
    const localRecord = list.find((event) => event.side === 'local' && event.kind === 'record');
    const localMark = list.find((event) => event.side === 'local' && event.kind === 'deleted');

    if (winner.side === 'local') {
      if (list.some((event) => event.side === 'incoming')) stats.unchanged++;
    } else if (winner.kind === 'record') {
      (plan.puts[winner.store] ??= []).push(winner.record);
      stats[localRecord ? 'changed' : 'added']++;
      if (localMark) plan.clearTombstones.push(id);
    } else {
      plan.tombstones.push(winner.mark);
      if (localRecord) {
        (plan.deletes[localRecord.store] ??= []).push(id);
        stats.removed++;
      }
    }
  }
  return plan;
}

// Liest eine Sicherungsdatei ein und führt sie mit dem lokalen Bestand zusammen.
export async function importBackup(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Die Datei ist zu groß für eine Sicherung.');
  const payload = parseBackup(await file.text());
  const plan = planMerge(await collectData(), payload);
  await store.commit({
    puts: plan.puts,
    deletes: plan.deletes,
    tombstones: plan.tombstones,
    clearTombstones: plan.clearTombstones,
    keepTimestamps: true,
  });
  return { ...plan.stats, exportedAt: payload.exportedAt ?? null };
}
