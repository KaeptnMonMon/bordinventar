// Artikel-, Kisten- und Stauraum-Dialoge samt Löschlogik und Menü.
// Schreibt über store.js und meldet danach über hooks.refresh() zurück an die Oberfläche.

import { html } from './html.js';
import * as store from './store.js';
import { showForm, confirmAction, showToast } from './overlay.js';
import { ZONE_BY_ID } from './zones.js';
import { showsContentsDirectly } from './model.js';

const collator = new Intl.Collator('de');
const UNITS = ['Stk', 'Paar', 'm', 'l', 'kg', 'Rolle', 'Dose', 'Packung'];
const CATEGORIES = ['Sicherheit', 'Motor', 'Rigg & Segel', 'Elektrik', 'Medizin', 'Proviant', 'Werkzeug', 'Tauwerk', 'Haushalt', 'Papiere'];
const SHELVES = ['Regal oben', 'Regal unten', 'Boden'];

// hooks: { getData(), getInventory(), flush(), refresh() }
let hooks = null;
export function initDialogs(options) {
  hooks = options;
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const field = (id, label, control) => html`<div class="field"><label for="${id}">${label}</label>${control}</div>`;
const suggestions = (defaults, used) => [...new Set([...defaults, ...used.filter(Boolean)])].sort(collator.compare);
const datalist = (id, values) => html`<datalist id="${id}">${values.map((value) => html`<option value="${value}"></option>`)}</datalist>`;

async function save(storeName, record, message) {
  await hooks.flush();
  await store.putRecord(storeName, record);
  await hooks.refresh();
  showToast(message);
}

// Alle Schreibvorgänge, die Kaskaden auslösen, laufen atomar über commit().
async function commitChanges(changes, message) {
  await hooks.flush();
  await store.commit(changes);
  await hooks.refresh();
  showToast(message);
}

/* ---------- Artikel ---------- */

function placeOptions(inventory) {
  if (inventory.locations.length === 0) {
    return html`<option value="" disabled>– noch kein Stauraum angelegt –</option>`;
  }
  return inventory.locations.map((location) => {
    // Ein Stauraum ohne Unterteilung ist selbst der Stauplatz.
    if (showsContentsDirectly(location)) return html`<option value="loc:${location.id}">${location.name}</option>`;
    const loose = location.subdivision === 'kisten' ? 'lose' : 'ohne Unterteilung';
    return html`<optgroup label="${location.name}">
      <option value="loc:${location.id}">${location.name} – ${loose}</option>
      ${(inventory.boxesByLocation.get(location.id) ?? []).map((box) => html`<option value="box:${box.id}">${box.title}${box.kind === 'kisten' && box.shelf ? ` (${box.shelf})` : ''}</option>`)}
    </optgroup>`;
  });
}

function parsePlace(inventory, value) {
  const separator = value.indexOf(':');
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (kind === 'box' && inventory.boxById.has(id)) {
    return { locationId: inventory.boxById.get(id).locationId, boxId: id };
  }
  if (kind === 'loc' && inventory.locationById.has(id)) return { locationId: id, boxId: null };
  throw new Error('Bitte einen Stauplatz wählen.');
}

// Vom Mülleimer in der Zeile und vom Bearbeiten-Dialog gemeinsam genutzt. false, wenn der
// Nutzer die Rückfrage verneint.
export async function deleteItem(itemId) {
  const item = hooks.getData().items.find((candidate) => candidate.id === itemId);
  if (!item) return false;
  const confirmed = await confirmAction({ title: 'Artikel löschen?', message: `„${item.name}“ wird gelöscht.`, confirmLabel: 'Löschen' });
  if (!confirmed) return false;
  await commitChanges({ deletes: { items: [item.id] } }, `„${item.name}“ gelöscht.`);
  return true;
}

// preselect: { boxId } oder { locationId } – der Ort, an dem man gerade steht.
export function openItemDialog({ itemId = null, preselect = null } = {}) {
  const inventory = hooks.getInventory();
  const data = hooks.getData();
  const item = itemId ? data.items.find((candidate) => candidate.id === itemId) : null;
  if (itemId && !item) return;

  let placeValue = '';
  if (item) {
    if (item.boxId && inventory.boxById.has(item.boxId)) placeValue = `box:${item.boxId}`;
    else if (inventory.locationById.has(item.locationId)) placeValue = `loc:${item.locationId}`;
  } else if (preselect?.boxId && inventory.boxById.has(preselect.boxId)) {
    placeValue = `box:${preselect.boxId}`;
  } else if (preselect?.locationId && inventory.locationById.has(preselect.locationId)) {
    placeValue = `loc:${preselect.locationId}`;
  }

  const body = html`
    ${field('f-name', 'Bezeichnung', html`<input id="f-name" name="name" required autocomplete="off" placeholder="z. B. Impeller Volvo D1-30" value="${item?.name ?? ''}">`)}
    ${field('f-place', 'Stauplatz', html`<select id="f-place" name="place" required>
      <option value="" disabled>Stauplatz wählen …</option>${placeOptions(inventory)}</select>`)}
    <div class="fieldrow">
      ${field('f-qty', 'Anzahl', html`<input id="f-qty" name="quantity" type="number" inputmode="decimal" step="any" min="0" value="${item ? item.quantity : 1}">`)}
      ${field('f-unit', 'Einheit', html`<input id="f-unit" name="unit" list="units" autocomplete="off" placeholder="Stk" value="${item ? item.unit : 'Stk'}">`)}
      ${field('f-min', 'Mindest', html`<input id="f-min" name="minQuantity" type="number" inputmode="decimal" step="any" min="0" placeholder="–" value="${item?.minQuantity ?? ''}">`)}
    </div>
    ${field('f-best', 'Haltbar bis', html`<span class="inputwrap"><input id="f-best" name="bestBefore" type="date" autocomplete="off" value="${item?.expiry ?? ''}"><button type="button" class="inputclear" data-clear-date aria-label="Datum entfernen" hidden>×</button></span>`)}
    ${field('f-cat', 'Kategorie', html`<input id="f-cat" name="category" list="categories" autocomplete="off" placeholder="–" value="${item?.category ?? ''}">`)}
    ${field('f-note', 'Notiz', html`<textarea id="f-note" name="note" placeholder="Typ, Maße, Kaufdatum …">${item?.note ?? ''}</textarea>`)}
    ${datalist('units', suggestions(UNITS, data.items.map((entry) => entry.unit)))}
    ${datalist('categories', suggestions(CATEGORIES, data.items.map((entry) => entry.category)))}`;

  const { form } = showForm({
    title: item ? 'Artikel bearbeiten' : 'Neuer Artikel',
    body,
    onSubmit: async (formElement) => {
      const values = new FormData(formElement);
      const name = String(values.get('name')).trim();
      if (!name) throw new Error('Bitte eine Bezeichnung eingeben.');
      const quantity = Number(values.get('quantity') || 0);
      const minimum = String(values.get('minQuantity')).trim();
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Die Anzahl muss eine Zahl ab 0 sein.');
      await save('items', {
        ...item,
        name,
        ...parsePlace(inventory, String(values.get('place'))),
        quantity,
        unit: String(values.get('unit')).trim(),
        minQuantity: minimum === '' ? null : Number(minimum),
        expiry: String(values.get('bestBefore')),
        category: String(values.get('category')).trim(),
        note: String(values.get('note')).trim(),
        isExample: false, // Was Armin bearbeitet, gehört ihm und ist kein Muster mehr.
      }, item ? 'Übernommen.' : `„${name}“ angelegt.`);
    },
    onDelete: item && (() => deleteItem(item.id)),
  });
  form.elements.place.value = placeValue;
  if (!item) form.elements.name.focus();

  // iOS bietet in Datumsfeldern kein „Leeren“ an; deshalb ein eigener Knopf.
  const dateInput = form.elements.bestBefore;
  const clearDate = form.querySelector('[data-clear-date]');
  const syncClear = () => { clearDate.hidden = dateInput.value === ''; };
  dateInput.addEventListener('input', syncClear);
  dateInput.addEventListener('change', syncClear);
  clearDate.addEventListener('click', () => { dateInput.value = ''; syncClear(); });
  syncClear();
}

/* ---------- Kiste ---------- */

export function openBoxDialog({ boxId = null, locationId = null } = {}) {
  const inventory = hooks.getInventory();
  const data = hooks.getData();
  const box = boxId ? data.boxes.find((candidate) => candidate.id === boxId) : null;
  const location = inventory.locationById.get(box ? box.locationId : locationId);
  if (!location || (boxId && !box)) return;
  if (location.subdivision === 'unterteilung') {
    openSectionDialog({ box, location, data });
    return;
  }

  const others = data.boxes.filter((candidate) => candidate.locationId === location.id && candidate.id !== box?.id);
  const taken = new Set(others.map((other) => other.number));
  let suggestion = 1;
  while (taken.has(suggestion)) suggestion++;

  const body = html`
    <div class="fieldrow">
      <div class="field field-narrow"><label for="b-no">Nummer</label>
        <input id="b-no" name="number" type="number" inputmode="numeric" min="1" step="1" value="${box ? (box.number ?? '') : suggestion}"></div>
      ${field('b-label', 'Beschriftung', html`<input id="b-label" name="label" autocomplete="off" placeholder="z. B. Motor & Ersatzteile" value="${box?.label ?? ''}">`)}
    </div>
    <p class="fieldhint" id="b-hint" hidden>Diese Nummer ist in „${location.name}“ schon vergeben. Das ist erlaubt, kann aber verwirren.</p>
    ${field('b-shelf', 'Regal / Ebene', html`<input id="b-shelf" name="shelf" list="shelves" autocomplete="off" placeholder="z. B. Regal oben" value="${box?.shelf ?? ''}">`)}
    ${datalist('shelves', suggestions(SHELVES, others.map((other) => other.shelf)))}`;

  const { form } = showForm({
    title: box ? 'Kiste bearbeiten' : `Neue Kiste in ${location.name}`,
    body,
    onSubmit: async (formElement) => {
      const values = new FormData(formElement);
      const number = String(values.get('number')).trim();
      await save('boxes', {
        ...box,
        locationId: location.id,
        number: number === '' ? null : Number(number),
        label: String(values.get('label')).trim(),
        shelf: String(values.get('shelf')).trim(),
      }, 'Kiste übernommen.');
    },
    onDelete: box && (async () => {
      const contained = data.items.filter((item) => item.boxId === box.id);
      const confirmed = await confirmAction({
        title: 'Kiste löschen?',
        message: contained.length
          ? contained.length === 1
            ? `In dieser Kiste liegt noch 1 Artikel. Er bleibt im Stauraum „${location.name}“ und gilt dort als lose.`
            : `In dieser Kiste liegen noch ${contained.length} Artikel. Sie bleiben im Stauraum „${location.name}“ und gelten dort als lose.`
          : `Kiste ${box.number ?? ''} wird gelöscht.`,
        confirmLabel: 'Löschen',
      });
      if (!confirmed) return false;
      await commitChanges({
        puts: { items: contained.map((item) => ({ ...item, boxId: null })) },
        deletes: { boxes: [box.id] },
      }, 'Kiste gelöscht.');
      return true;
    }),
  });

  const hint = form.querySelector('#b-hint');
  const numberInput = form.elements.number;
  const checkNumber = () => { hint.hidden = numberInput.value === '' || !taken.has(Number(numberInput.value)); };
  numberInput.addEventListener('input', checkNumber);
  checkNumber();
}

// Unterteilung: nur ein frei gewählter Name („Mitte“, „Vorne“), keine Nummer, keine Ebene.
function openSectionDialog({ box, location, data }) {
  const body = field('s-label', 'Bezeichnung', html`<input id="s-label" name="label" required autocomplete="off" placeholder="z. B. Mitte oder Vorne" value="${box?.label ?? ''}">`);
  const { form } = showForm({
    title: box ? 'Unterteilung bearbeiten' : `Neue Unterteilung in ${location.name}`,
    body,
    onSubmit: async (formElement) => {
      const label = String(new FormData(formElement).get('label')).trim();
      if (!label) throw new Error('Bitte eine Bezeichnung eingeben.');
      await save('boxes', { ...box, locationId: location.id, number: null, label, shelf: '' }, 'Unterteilung übernommen.');
    },
    onDelete: box && (async () => {
      const contained = data.items.filter((item) => item.boxId === box.id);
      const confirmed = await confirmAction({
        title: 'Unterteilung löschen?',
        message: contained.length === 0
          ? `„${box.label}“ wird gelöscht.`
          : contained.length === 1
            ? `In „${box.label}“ liegt noch 1 Artikel. Er bleibt im Stauraum „${location.name}“ und gilt dort als ohne Unterteilung.`
            : `In „${box.label}“ liegen noch ${contained.length} Artikel. Sie bleiben im Stauraum „${location.name}“ und gelten dort als ohne Unterteilung.`,
        confirmLabel: 'Löschen',
      });
      if (!confirmed) return false;
      await commitChanges({
        puts: { items: contained.map((item) => ({ ...item, boxId: null })) },
        deletes: { boxes: [box.id] },
      }, 'Unterteilung gelöscht.');
      return true;
    }),
  });
  if (!box) form.elements.label.focus();
}

/* ---------- Stauraum ---------- */
// Die Stauräume des Schiffsplans legt die App selbst an (ein Bereich = ein Stauraum). Hier lassen
// sie sich umbenennen; löschen lassen sich nur zusätzliche Stauräume ohne Bereich.

export function openLocationDialog({ locationId = null } = {}) {
  const data = hooks.getData();
  const location = locationId ? data.locations.find((candidate) => candidate.id === locationId) : null;
  if (locationId && !location) return;
  const zone = location?.zone ? ZONE_BY_ID.get(location.zone) : null;

  const body = html`
    ${field('l-name', 'Bezeichnung', html`<input id="l-name" name="name" required autocomplete="off" placeholder="z. B. Cockpitschapp" value="${location?.name ?? ''}">`)}
    ${zone
      ? html`<p class="fieldnote">Bereich im Schiffsplan: ${zone.label}. Dieser Stauraum gehört fest dazu.</p>`
      : html`<p class="fieldnote">Zusätzlicher Stauraum ohne Position im Schiffsplan.</p>`}`;

  const { form } = showForm({
    title: location ? 'Stauraum bearbeiten' : 'Neuer Stauraum',
    body,
    onSubmit: async (formElement) => {
      const name = String(new FormData(formElement).get('name')).trim();
      if (!name) throw new Error('Bitte eine Bezeichnung eingeben.');
      const nextOrder = Math.max(0, ...data.locations.map((other) => other.order ?? 0)) + 10;
      await save('locations', {
        ...location,
        name,
        zone: location?.zone ?? '',
        order: location ? location.order : nextOrder,
      }, location ? 'Stauraum übernommen.' : `„${name}“ angelegt.`);
    },
    onDelete: location && !location.zone && (async () => {
      const boxes = data.boxes.filter((box) => box.locationId === location.id);
      const items = data.items.filter((item) => item.locationId === location.id);
      const confirmed = await confirmAction({
        title: 'Stauraum löschen?',
        message: boxes.length || items.length
          ? `„${location.name}“ enthält ${plural(boxes.length, 'Kiste', 'Kisten')} und ${plural(items.length, 'Artikel', 'Artikel')}. Alles wird mitgelöscht.`
          : `„${location.name}“ wird gelöscht.`,
        confirmLabel: 'Alles löschen',
      });
      if (!confirmed) return false;
      await commitChanges({
        deletes: {
          items: items.map((item) => item.id),
          boxes: boxes.map((box) => box.id),
          locations: [location.id],
        },
      }, `„${location.name}“ gelöscht.`);
      return true;
    }),
  });
  if (!location) form.elements.name.focus();
}
