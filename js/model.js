// Abgeleitete Werte: Ablauf, Mindestbestand, Stauplatz-Texte, Suchindex. Kennt weder DOM noch Datenbank.

import { ZONE_BY_ID, ZONE_IDS, ZONE_RANK } from './zones.js';

export const EXPIRY_WARNING_DAYS = 180;
export const EXPIRY_CRITICAL_DAYS = 60;

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
export const byName = (a, b) => collator.compare(a.name, b.name);

// „schaekel“, „schäkel“ und „SCHAEKEL“ sollen dasselbe sein.
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchTokens(query) {
  const normalized = normalizeText(query);
  return normalized === '' ? [] : normalized.split(' ');
}

// Mehrere Begriffe werden UND-verknüpft.
export function filterItems(items, tokens) {
  return items.filter((item) => tokens.every((token) => item.searchText.includes(token)));
}

/* ---------- Datum und Zahlen ---------- */

export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Über UTC gerechnet, damit die Zeitumstellung keinen Tag verschluckt.
function dayNumber(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function daysUntil(iso, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return null;
  return Math.round(dayNumber(iso) - dayNumber(today));
}

export function formatDate(iso) {
  const [year, month, day] = String(iso).slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

export function formatTimestamp(iso) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(Math.round(number * 100) / 100).replace('.', ',');
}

/* ---------- Stauplatz ---------- */

const isSection = (box) => box.kind === 'unterteilung';

// Kiste: „Kiste 4 · Tauwerk“; Unterteilung: nur ihr Name.
const partTitle = (box) => (isSection(box)
  ? box.label || 'Unterteilung'
  : `Kiste ${box.number ?? '?'}${box.label ? ` · ${box.label}` : ''}`);

// Zeigt der Stauraum seine Artikel direkt, ohne Kacheln? Ja, solange er nichts unterteilt.
export const showsContentsDirectly = (location) => location.subdivision === null
  || (location.subdivision === 'unterteilung' && !location.hasParts);

function placeLabel(location, box) {
  if (!location) return 'ohne Stauraum';
  if (!box) return location.subdivision === 'kisten' ? `lose in ${location.name}` : location.name;
  if (isSection(box)) return `${location.name} · ${partTitle(box)}`;
  return [`Kiste ${box.number ?? '?'}`, box.shelf, location.name].filter(Boolean).join(' · ');
}

function statusBadges(item) {
  const badges = [];
  if (item.daysLeft !== null) {
    const date = formatDate(item.expiry);
    if (item.daysLeft < 0) badges.push({ tone: 'crit', text: `abgelaufen ${date}` });
    else if (item.daysLeft <= EXPIRY_CRITICAL_DAYS) badges.push({ tone: 'crit', text: `läuft ab ${date}` });
    else if (item.daysLeft <= EXPIRY_WARNING_DAYS) badges.push({ tone: 'warn', text: `bis ${date}` });
    else badges.push({ tone: '', text: `bis ${date}` });
  }
  if (item.isLow) badges.push({ tone: 'warn', text: 'unter Mindestbestand' });
  return badges;
}

const hasValue = (value) => value !== null && value !== undefined && value !== '';

function decorateItem(item, locationById, boxById, today) {
  const location = locationById.get(item.locationId) ?? null;
  // Verweist boxId ins Leere, gilt der Artikel als lose, statt zu verschwinden.
  const box = (item.boxId && boxById.get(item.boxId)) || null;
  const place = placeLabel(location, box);
  const daysLeft = daysUntil(item.expiry, today);
  const isLow = hasValue(item.minQuantity) && Number(item.quantity) < Number(item.minQuantity);
  const decorated = {
    ...item,
    location,
    box,
    zoneId: location?.zone ?? '',
    place,
    // „lose“ sagt nur in Kisten-Stauräumen etwas; sonst steht der Stauraum im Klartext daneben.
    shortPlace: box ? (isSection(box) ? partTitle(box) : `K${box.number ?? '?'}`) : (location?.subdivision === 'kisten' ? 'lose' : ''),
    daysLeft,
    isLow,
    needsAttention: (daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS) || isLow,
    searchText: normalizeText([item.name, item.category, item.note, place, box?.label].join(' ')),
  };
  decorated.badges = statusBadges(decorated);
  return decorated;
}

function pushTo(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

// Baut aus den Rohdaten der drei Objektspeicher alles, was die Ansichten brauchen.
export function buildInventory({ locations, boxes, items }, today = todayIso()) {
  const locationList = locations
    .map((location) => ({ ...location, zone: ZONE_IDS.has(location.zone) ? location.zone : '' }))
    .sort((a, b) => (ZONE_RANK.get(a.zone) ?? Infinity) - (ZONE_RANK.get(b.zone) ?? Infinity)
      || (a.order ?? 0) - (b.order ?? 0) || byName(a, b));
  const locationById = new Map(locationList.map((location) => [location.id, location]));

  const boxList = boxes
    .map((box) => ({ ...box, number: box.number ?? null, label: box.label ?? '', shelf: box.shelf ?? '' }))
    .sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || collator.compare(a.label, b.label));
  const boxById = new Map(boxList.map((box) => [box.id, box]));

  const boxesByLocation = new Map();
  for (const box of boxList) pushTo(boxesByLocation, box.locationId, box);

  // Wie sich ein Stauraum unterteilt, bestimmt sein Bereich. Zusätzliche Stauräume ohne Bereich und
  // ältere Daten mit vorhandenen Kisten behalten Kisten.
  for (const location of locationList) {
    location.hasParts = (boxesByLocation.get(location.id) ?? []).length > 0;
    const declared = location.zone ? ZONE_BY_ID.get(location.zone).subdivision ?? null : 'kisten';
    location.subdivision = declared ?? (location.hasParts ? 'kisten' : null);
  }
  for (const box of boxList) {
    box.kind = locationById.get(box.locationId)?.subdivision === 'unterteilung' ? 'unterteilung' : 'kisten';
    box.title = partTitle(box);
  }

  const locationsByZone = new Map();
  for (const location of locationList) if (location.zone) pushTo(locationsByZone, location.zone, location);

  const itemList = items.map((item) => decorateItem(item, locationById, boxById, today)).sort(byName);

  const stamps = [...locations, ...boxes, ...items].map((record) => record.updatedAt).filter(Boolean).sort();

  return {
    locations: locationList,
    items: itemList,
    locationById,
    boxById,
    boxesByLocation,
    locationsByZone,
    savedAt: stamps.at(-1) ?? null,
    counts: {
      items: itemList.length,
      locations: locationList.length,
      attention: itemList.filter((item) => item.needsAttention).length,
    },
  };
}

// Artikelzahlen je Kiste, Stauraum und lose im Stauraum – für genau die übergebene Artikelmenge,
// also bei aktiver Suche die Trefferzahlen.
export function countItems(items) {
  const byBox = new Map();
  const byLocation = new Map();
  const looseByLocation = new Map();
  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const item of items) {
    bump(byLocation, item.locationId);
    if (item.box) bump(byBox, item.box.id);
    else bump(looseByLocation, item.locationId);
  }
  return { byBox, byLocation, looseByLocation };
}

// Die drei Blöcke des Reiters „Prüfen“, sortiert nach Ablaufdatum, dann alphabetisch.
export function reviewGroups(items) {
  const byExpiry = (a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999') || byName(a, b);
  return {
    expired: items.filter((item) => item.daysLeft !== null && item.daysLeft < 0).sort(byExpiry),
    expiring: items.filter((item) => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= EXPIRY_WARNING_DAYS).sort(byExpiry),
    restock: items.filter((item) => item.isLow).sort(byExpiry),
  };
}
