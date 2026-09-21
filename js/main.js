import * as store from './store.js';
import { buildInventory, countItems, filterItems, formatTimestamp, searchTokens, showsContentsDirectly } from './model.js';
import { renderMain } from './views.js';
import { closeAllOverlays, hasOverlay } from './overlay.js';
import { deleteItem, initDialogs, openBoxDialog, openItemDialog, openLocationDialog } from './dialogs.js';
import { initMenu, openMenu } from './menu.js';
import { ZONES } from './zones.js';

const $ = (id) => document.getElementById(id);
const view = $('view');
const alertBox = $('alert');
const searchInput = $('q');
const clearButton = $('clearq');
const header = document.querySelector('.topbar');
const tabButtons = [...document.querySelectorAll('[data-tab]')];

const ROOT_STATE = { tab: 'alles', open: null, zoneId: null, focusId: null };
// Was „zurück“ aus einer Kiste bzw. aus dem Bereichsfenster des Plans bedeutet.
const PARENT_STATE = {
  open: { open: null, focusId: null },
  zone: { zoneId: null, open: null, focusId: null },
};
const QUANTITY_WRITE_DELAY_MS = 500;

let state = { ...ROOT_STATE };
let query = '';
let data = { locations: [], boxes: [], items: [] }; // Rohdaten, so wie sie in IndexedDB stehen
let inventory = null;                               // daraus abgeleitet, siehe model.js

function showError(error) {
  console.error(error);
  alertBox.textContent = error instanceof store.StoreError
    ? error.message
    : `Unerwarteter Fehler: ${error?.message ?? error}`;
  alertBox.hidden = false;
}

window.addEventListener('unhandledrejection', (event) => showError(event.reason));
window.addEventListener('error', (event) => showError(event.error ?? event.message));

/* ---------- Daten ---------- */

function rebuild() {
  inventory = buildInventory(data);
}

async function loadData() {
  const [locations, boxes, items] = await Promise.all(store.STORE_NAMES.map(store.getAll));
  data = { locations, boxes, items };
  rebuild();
}

// Mengenänderungen sofort anzeigen, aber gebündelt schreiben: ein Schreibvorgang je Ruhepause.
const pendingQuantities = new Set();
let quantityTimer = null;

async function flush() {
  clearTimeout(quantityTimer);
  quantityTimer = null;
  if (pendingQuantities.size === 0) return;
  const ids = [...pendingQuantities];
  pendingQuantities.clear();
  try {
    const written = await store.commit({ puts: { items: data.items.filter((item) => ids.includes(item.id)) } });
    for (const record of written.items) {
      const local = data.items.find((item) => item.id === record.id);
      if (local) local.updatedAt = record.updatedAt;
    }
  } catch (error) {
    for (const id of ids) pendingQuantities.add(id); // beim nächsten Versuch erneut schreiben
    throw error;
  }
}

async function refresh() {
  await flush();
  await loadData();
  render();
}

function stepQuantity(itemId, delta) {
  const item = data.items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  item.quantity = Math.max(0, Math.round((Number(item.quantity || 0) + delta) * 100) / 100);
  pendingQuantities.add(itemId);
  rebuild();
  render();
  clearTimeout(quantityTimer);
  quantityTimer = setTimeout(() => flush().catch(showError), QUANTITY_WRITE_DELAY_MS);
}

// iOS beendet die App ohne Vorwarnung; sobald sie in den Hintergrund geht, sofort schreiben.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush().catch(showError);
});
window.addEventListener('pagehide', () => flush().catch(showError));

/* ---------- Darstellung ---------- */

function render() {
  const tokens = searchTokens(query);
  const items = tokens.length ? filterItems(inventory.items, tokens) : inventory.items;
  const ctx = {
    inventory,
    state,
    query: query.trim(),
    searching: tokens.length > 0,
    items,
    counts: countItems(items),
  };
  view.innerHTML = String(renderMain(ctx));

  for (const button of tabButtons) {
    button.setAttribute('aria-selected', String(button.dataset.tab === state.tab));
  }
  $('cnt-alles').textContent = inventory.counts.items || '';
  $('cnt-stauraeume').textContent = inventory.counts.locations || '';
  $('cnt-pruefen').textContent = inventory.counts.attention || '';
  $('stand').textContent = inventory.savedAt ? `· Stand ${formatTimestamp(inventory.savedAt)}` : '';
  clearButton.hidden = query === '';
  document.body.classList.toggle('has-sheet', view.querySelector('.sheet') !== null);

  view.querySelector('.sheet .is-focus')?.scrollIntoView({ block: 'nearest' });
}

// Auf dem Telefon liegt das Bereichsfenster über dem unteren Bildschirmteil.
// Den gewählten Bereich so weit scrollen, dass er darüber sichtbar bleibt.
function revealSelectedZone() {
  const zone = view.querySelector('.zone.is-selected');
  const sheet = view.querySelector('.sheet');
  if (!zone || !sheet || getComputedStyle(sheet).position !== 'fixed') return;
  const zoneBox = zone.getBoundingClientRect();
  const visibleTop = header.getBoundingClientRect().bottom + 8;
  const visibleBottom = sheet.getBoundingClientRect().top - 8;
  if (zoneBox.bottom > visibleBottom) {
    window.scrollBy(0, Math.min(zoneBox.bottom - visibleBottom, zoneBox.top - visibleTop));
  } else if (zoneBox.top < visibleTop) {
    window.scrollBy(0, zoneBox.top - visibleTop);
  }
}

/* ---------- Navigation ---------- */
// Jede Änderung von Reiter, Kiste oder Bereich ist ein Verlaufseintrag, damit die
// Zurück-Geste des Telefons innerhalb der App bleibt.

function go(patch, { replace = false, top = false, reveal = false } = {}) {
  state = { ...state, ...patch };
  if (replace) history.replaceState(state, '');
  else history.pushState(state, '');
  render();
  if (top) window.scrollTo(0, 0);
  if (reveal) revealSelectedZone();
}

function initHistory() {
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (installed) {
    // Ein Eintrag vor der Startansicht fängt die Zurück-Geste ab, die sonst die App verließe.
    history.replaceState({ sentinel: true }, '');
    history.pushState(state, '');
  } else {
    history.replaceState(state, '');
  }
}

window.addEventListener('popstate', (event) => {
  if (hasOverlay()) {
    // Die Zurück-Geste schließt nur das offene Fenster; die Navigation bleibt, wo sie war.
    closeAllOverlays();
    history.pushState(state, '');
    return;
  }
  if (event.state?.sentinel) {
    history.pushState(state, '');
    return;
  }
  state = { ...ROOT_STATE, ...event.state };
  render();
});

/* ---------- Bedienung ---------- */

// Der Ort, an dem man gerade steht: damit „+ Artikel“ den Stauplatz schon vorwählt.
function currentPlace() {
  const [kind, id] = String(state.open ?? '').split(':');
  if (kind === 'box') return { boxId: id };
  if (kind === 'loose') return { locationId: id };
  const locations = inventory.locationsByZone.get(state.zoneId) ?? [];
  return locations.length === 1 ? { locationId: locations[0].id } : null;
}

function locateItem(itemId) {
  const item = inventory.items.find((candidate) => candidate.id === itemId);
  if (!item?.zoneId) return;
  go({
    tab: 'plan',
    zoneId: item.zoneId,
    // Stauräume ohne Unterteilung zeigen ihre Artikel direkt; sonst die Kiste bzw. Unterteilung öffnen.
    open: showsContentsDirectly(item.location) ? null : item.box ? `box:${item.box.id}` : `loose:${item.locationId}`,
    focusId: item.id,
  }, { top: true, reveal: true });
}

function selectZone(zoneId) {
  if (zoneId === state.zoneId) {
    go(PARENT_STATE.zone, { replace: true });
    return;
  }
  // Von einem Bereich zum nächsten wechseln ersetzt den Eintrag, damit „zurück“ nicht durch alle Bereiche läuft.
  go({ zoneId, open: null, focusId: null }, { replace: state.zoneId !== null, reveal: true });
}

// Jedes data-…-Attribut im Markup entspricht einer Aktion. Der Wert kommt als erstes Argument.
const ACTIONS = {
  tab: (tab) => {
    if (tab !== state.tab || state.open || state.zoneId) go({ ...ROOT_STATE, tab }, { top: true });
  },
  open: (open) => go({ open, focusId: null }, { top: state.tab !== 'plan' }),
  zone: selectZone,
  locate: locateItem,
  up: (which) => go(PARENT_STATE[which], { replace: true, top: state.tab !== 'plan' }),
  showPlan: () => go({ ...ROOT_STATE, tab: 'plan' }, { top: true }),
  step: (delta, { id }) => stepQuantity(id, Number(delta)),
  editItem: (id) => openItemDialog({ itemId: id }),
  deleteItem,
  newItem: () => openItemDialog({ preselect: currentPlace() }),
  editBox: (id) => openBoxDialog({ boxId: id }),
  newBox: (locationId) => openBoxDialog({ locationId }),
  editLocation: (id) => openLocationDialog({ locationId: id }),
  menu: openMenu,
};

const toAttribute = (key) => `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
const ACTION_SELECTOR = Object.keys(ACTIONS).map((key) => `[${toAttribute(key)}]`).join(',');

document.addEventListener('click', (event) => {
  const target = event.target.closest(ACTION_SELECTOR);
  if (!target) return;
  const key = Object.keys(ACTIONS).find((candidate) => candidate in target.dataset);
  ACTIONS[key](target.dataset[key], target.dataset);
});

// Die Bereiche im Plan sind SVG-Gruppen mit role="button" und brauchen die Tastatur selbst.
document.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('[data-zone]')) {
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  render();
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') searchInput.blur();
});
clearButton.addEventListener('click', () => {
  query = '';
  searchInput.value = '';
  render();
  searchInput.focus();
});

// Die klebende Kopfleiste ist unterschiedlich hoch; das Bereichsfenster am Desktop klebt darunter.
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
}).observe(header);

async function start() {
  await store.initStore();
  await store.ensureZoneLocations(ZONES);
  await loadData();
  const hooks = { getData: () => data, getInventory: () => inventory, flush, refresh };
  initDialogs(hooks);
  initMenu(hooks);
  initHistory();
  render();
}

// Erst nach dem Laden, damit das Zwischenspeichern der App nicht mit dem Start konkurriert.
// Ohne Service Worker läuft die App weiter, nur nicht offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .catch((error) => console.warn('Offline-Betrieb nicht verfügbar:', error));
  });
}

start().catch(showError);
