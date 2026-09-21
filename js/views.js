// Rendering der Reiter. Reine Funktionen: Kontext hinein, Markup heraus.
//
// ctx = { inventory, state, query, searching, items, counts }
//   items:  die sichtbaren Artikel – bei aktiver Suche nur die Treffer
//   counts: Artikelzahlen je Kiste/Stauraum für genau diese Artikel
//   state.open: 'box:<id>' oder 'loose:<locationId>' – die gerade geöffnete Kiste

import { html, raw } from './html.js';
import { ZONES, ZONE_BY_ID } from './zones.js';
import { renderPlanSvg } from './plan.js';
import { formatQuantity, reviewGroups, showsContentsDirectly } from './model.js';

const TRASH_ICON = raw('<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h12M7 5V3.5h4V5M5 5l.6 9.5h6.8L13 5M7.6 8v4.2M10.4 8v4.2"/></svg>');
const PIN_ICON = raw('<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 16s5-4.6 5-8.5a5 5 0 0 0-10 0C4 11.4 9 16 9 16Z"/><circle cx="9" cy="7.5" r="1.8"/></svg>');

export function renderMain(ctx) {
  const { tab } = ctx.state;
  if (tab === 'plan') return renderPlan(ctx);
  if (ctx.searching) return renderSearch(ctx);
  if (tab === 'stauraeume') return renderLocations(ctx);
  if (tab === 'pruefen') return renderReview(ctx);
  return renderAll(ctx);
}

/* ---------- Bausteine ---------- */

const emptyState = (title, text) => html`<div class="empty"><strong>${title}</strong>${text}</div>`;

function itemRow(item, { locate = false, focus = false } = {}) {
  const edit = html`data-edit-item="${item.id}"`;
  return html`<div class="row${focus ? ' is-focus' : ''}">
    <div class="rowline">
      <button type="button" class="rowmain" ${edit}><span class="rowname">${item.name}</span></button>
      <div class="stepper">
        <button type="button" data-step="-1" data-id="${item.id}" aria-label="weniger: ${item.name}">−</button>
        <div class="qty num">${formatQuantity(item.quantity)}${item.unit ? html`<small>&nbsp;${item.unit}</small>` : ''}</div>
        <button type="button" data-step="1" data-id="${item.id}" aria-label="mehr: ${item.name}">+</button>
      </div>
    </div>
    <div class="rowline">
      <button type="button" class="rowmain" ${edit}>
        <span class="rowmeta">
          ${item.shortPlace ? html`<span class="badge loc num">${item.shortPlace}</span>` : ''}
          ${item.category ? html`<span class="badge">${item.category}</span>` : ''}
          ${item.badges.map((badge) => html`<span class="badge ${badge.tone}">${badge.text}</span>`)}
          <span>${item.place}</span>
        </span>
      </button>
      <button type="button" class="trashbtn" data-delete-item="${item.id}" aria-label="Löschen: ${item.name}">${TRASH_ICON}</button>
    </div>
    ${locate && item.zoneId
      ? html`<button type="button" class="locatebtn" data-locate="${item.id}">${PIN_ICON}Im Plan zeigen</button>`
      : ''}
  </div>`;
}

const itemList = (items, options) => html`<div class="list">${items.map((item) => itemRow(item, options))}</div>`;

const groupBlock = (title, sub, body) => html`<div class="group">
  <div class="grouphead"><h2>${title}</h2><span class="sub">${sub}</span></div>${body}</div>`;

function boxTile(ctx, box) {
  const count = ctx.counts.byBox.get(box.id) ?? 0;
  const section = box.kind === 'unterteilung';
  return html`<button class="boxbtn${ctx.searching && count === 0 ? ' is-dim' : ''}" data-open="box:${box.id}">
    ${section ? '' : html`<span class="boxno num">${box.number ?? '?'}</span>`}
    <span><span class="boxlabel">${section ? box.title : box.label || `Kiste ${box.number ?? ''}`}</span>
    <span class="boxcount">${count} ${ctx.searching ? 'Treffer' : 'Artikel'}</span></span>
  </button>`;
}

const LOOSE_LABELS = { kisten: 'lose im Stauraum', unterteilung: 'ohne Unterteilung' };

function looseTile(ctx, location) {
  const count = ctx.counts.looseByLocation.get(location.id) ?? 0;
  const section = location.subdivision === 'unterteilung';
  return html`<button class="boxbtn${ctx.searching && count === 0 ? ' is-dim' : ''}" data-open="loose:${location.id}">
    ${section ? '' : html`<span class="boxno num">–</span>`}
    <span><span class="boxlabel">${LOOSE_LABELS[location.subdivision] ?? 'Inhalt'}</span>
    <span class="boxcount">${count} ${ctx.searching ? 'Treffer' : 'Artikel'}</span></span>
  </button>`;
}

// Kisten bzw. Unterteilungen eines Stauraums als Kacheln, Kisten gruppiert nach Ebene, am Ende „lose“.
function boxTiles(ctx, location) {
  const boxes = ctx.inventory.boxesByLocation.get(location.id) ?? [];
  const shelfOf = (box) => (location.subdivision === 'kisten' ? box.shelf : '');
  const shelves = [...new Set(boxes.map(shelfOf))];
  const hasLoose = (ctx.counts.looseByLocation.get(location.id) ?? 0) > 0 || boxes.length === 0;
  return html`${shelves.map((shelf) => html`
    ${shelf ? html`<div class="shelf">${shelf}</div>` : ''}
    <div class="boxgrid">${boxes.filter((box) => shelfOf(box) === shelf).map((box) => boxTile(ctx, box))}</div>`)}
    ${hasLoose ? html`<div class="boxgrid">${looseTile(ctx, location)}</div>` : ''}`;
}

// Was hinter state.open steckt; null, wenn der Verweis ins Leere geht.
function openTarget(inventory, key) {
  const [kind, id] = String(key ?? '').split(':');
  if (kind === 'box') {
    const box = inventory.boxById.get(id);
    const location = box && inventory.locationById.get(box.locationId);
    if (!box || !location) return null;
    return {
      title: box.title,
      box,
      sub: [box.shelf, location.name].filter(Boolean).join(' · '),
      location,
      contains: (item) => item.box?.id === box.id,
    };
  }
  if (kind === 'loose') {
    const location = inventory.locationById.get(id);
    if (!location) return null;
    const titles = { kisten: [`Lose in ${location.name}`, 'ohne Kiste'], unterteilung: ['Ohne Unterteilung', location.name] };
    const [title, sub] = titles[location.subdivision] ?? [location.name, 'Inhalt'];
    return { title, box: null, sub, location, contains: (item) => item.locationId === location.id && !item.box };
  }
  return null;
}

function renderOpen(ctx, target, backLabel) {
  const items = ctx.items.filter(target.contains);
  const empty = ctx.searching
    ? emptyState('Keine Treffer', 'Hier passt kein Artikel zur Suche.')
    : emptyState('Noch leer', 'Hier liegt noch nichts.');
  return html`<button class="btn ghost backbtn" data-up="open">‹ ${backLabel}</button>
    ${groupBlock(target.title, target.sub, items.length
      ? html`<div class="list">${items.map((item) => itemRow(item, { focus: item.id === ctx.state.focusId }))}</div>`
      : empty)}
    <div class="rowactions">
      <button type="button" class="btn primary" data-new-item>+ Artikel</button>
      ${target.box ? html`<button type="button" class="btn" data-edit-box="${target.box.id}">${target.box.kind === 'unterteilung' ? 'Unterteilung' : 'Kiste'} bearbeiten</button>` : ''}
    </div>`;
}

/* ---------- Reiter „Alles“ ---------- */

function renderAll({ inventory, items }) {
  if (items.length === 0) {
    return emptyState('Noch keine Artikel', 'Unten rechts auf „Artikel“ tippen und den ersten Eintrag anlegen.');
  }
  const sections = inventory.locations.map((location) => {
    const inLocation = items.filter((item) => item.locationId === location.id);
    if (inLocation.length === 0) return '';
    const boxes = (inventory.boxesByLocation.get(location.id) ?? [])
      .map((box) => ({
        title: box.title,
        sub: box.shelf,
        items: inLocation.filter((item) => item.box?.id === box.id),
      }));
    boxes.push({ title: 'ohne Kiste', sub: '', items: inLocation.filter((item) => !item.box) });
    return groupBlock(location.name, `${inLocation.length} Artikel`, boxes
      .filter((group) => group.items.length > 0)
      .map((group) => html`<div class="sublabel">${group.title}${group.sub ? html` <span>· ${group.sub}</span>` : ''}</div>
        ${itemList(group.items)}`));
  });
  const orphans = items.filter((item) => !item.location);
  return html`${sections}${orphans.length ? groupBlock('Ohne Stauraum', orphans.length, itemList(orphans)) : ''}`;
}

/* ---------- Reiter „Stauräume“ ---------- */

function renderLocations(ctx) {
  const { inventory, counts } = ctx;
  const target = openTarget(inventory, ctx.state.open);
  if (target) return renderOpen(ctx, target, 'Alle Stauräume');
  if (inventory.locations.length === 0) {
    return emptyState('Keine Stauräume', 'Über das Menü oben rechts den ersten Stauraum anlegen.');
  }
  return html`${inventory.locations.map((location) => {
    return html`<section class="loccard">
      <div class="lochead"><div><h2>${location.name}</h2>
        <div class="sub">${[partsCount(inventory, location), countLabel(ctx, location)].filter(Boolean).join(' · ')}</div></div>
        <button type="button" class="iconbtn" data-edit-location="${location.id}" aria-label="Stauraum bearbeiten: ${location.name}">✎</button></div>
      ${boxTiles(ctx, location)}
      ${location.subdivision
        ? html`<div class="rowactions rowactions-card"><button type="button" class="addbtn" data-new-box="${location.id}">+ ${PART_NOUN[location.subdivision]} in diesem Stauraum</button></div>`
        : html`<div class="rowactions-card"></div>`}
    </section>`;
  })}`;
}

/* ---------- Reiter „Plan“ ---------- */

function zoneStates(ctx) {
  const { inventory, counts, searching, state } = ctx;
  return new Map(ZONES.map((zone) => {
    const locations = inventory.locationsByZone.get(zone.id) ?? [];
    const count = locations.reduce((sum, location) => sum + (counts.byLocation.get(location.id) ?? 0), 0);
    const assigned = locations.length > 0;
    return [zone.id, {
      assigned,
      count,
      selected: state.zoneId === zone.id,
      hit: searching && count > 0,
      dim: searching && assigned && count === 0,
    }];
  }));
}

const PART_NOUN = { kisten: 'Kiste', unterteilung: 'Unterteilung' };

function partsCount(inventory, location) {
  const count = (inventory.boxesByLocation.get(location.id) ?? []).length;
  if (location.subdivision === 'kisten') return count === 1 ? '1 Kiste' : `${count} Kisten`;
  if (location.subdivision === 'unterteilung' && count > 0) return count === 1 ? '1 Unterteilung' : `${count} Unterteilungen`;
  return '';
}

const countLabel = (ctx, location) => `${ctx.counts.byLocation.get(location.id) ?? 0} ${ctx.searching ? 'Treffer' : 'Artikel'}`;

// Bereich mit Kisten: Kacheln, dazu „+ Kiste“ und Umbenennen.
function sheetBoxes(ctx, location) {
  return html`${boxTiles(ctx, location)}
    <div class="rowactions">
      <button type="button" class="addbtn" data-new-box="${location.id}">+ ${PART_NOUN[location.subdivision]}</button>
      <button type="button" class="addbtn" data-edit-location="${location.id}">Stauraum bearbeiten</button>
    </div>`;
}

// Bereich ohne Kisten: Er ist selbst der Stauraum, die Artikel liegen direkt darin.
function sheetContents(ctx, location) {
  const items = ctx.items.filter((item) => item.locationId === location.id);
  const empty = ctx.searching
    ? emptyState('Keine Treffer', 'Hier passt kein Artikel zur Suche.')
    : emptyState('Noch leer', 'Hier liegt noch nichts.');
  return html`${items.length
      ? html`<div class="list">${items.map((item) => itemRow(item, { focus: item.id === ctx.state.focusId }))}</div>`
      : empty}
    <div class="rowactions">
      <button type="button" class="btn primary" data-new-item>+ Artikel</button>
      ${location.subdivision ? html`<button type="button" class="btn" data-new-box="${location.id}">+ ${PART_NOUN[location.subdivision]}</button>` : ''}
      <button type="button" class="btn" data-edit-location="${location.id}">Umbenennen</button>
    </div>`;
}

function renderSheet(ctx, zone) {
  const locations = ctx.inventory.locationsByZone.get(zone.id) ?? [];
  const target = openTarget(ctx.inventory, ctx.state.open);
  const showTarget = target && locations.includes(target.location);

  let body;
  if (showTarget) {
    body = renderOpen(ctx, target, target.location.name);
  } else if (locations.length === 0) {
    body = emptyState('Kein Stauraum', 'Zu diesem Bereich gibt es noch keinen Stauraum. Er wird beim nächsten Start angelegt.');
  } else {
    body = locations.map((location) => {
      const content = showsContentsDirectly(location) ? sheetContents(ctx, location) : sheetBoxes(ctx, location);
      // Die Überschrift wiederholt nur dann den Namen des Bereichs nicht, wenn sie etwas Neues sagt.
      if (locations.length === 1 && location.name === zone.label) return content;
      return groupBlock(location.name, countLabel(ctx, location), content);
    });
  }
  return html`<aside class="sheet" aria-label="${zone.label}">
    <div class="sheethead"><h2>${zone.label}</h2>
      <button class="iconbtn" data-up="zone" aria-label="Schließen">×</button></div>
    <div class="sheetbody">${body}</div>
  </aside>`;
}

function planHint(ctx) {
  if (!ctx.searching) return 'Bereich antippen, um den Inhalt zu sehen.';
  if (ctx.items.length === 0) return `Kein Artikel enthält „${ctx.query}“.`;
  const unplaced = ctx.items.filter((item) => !item.zoneId).length;
  const found = `${ctx.items.length} Treffer für „${ctx.query}“ – markierte Bereiche antippen.`;
  return unplaced ? `${found} ${unplaced} davon ohne Position im Plan.` : found;
}

function renderPlan(ctx) {
  const zone = ZONE_BY_ID.get(ctx.state.zoneId);
  return html`<div class="planview${zone ? ' has-sheet' : ''}">
    <div class="plancol">
      <p class="planhint">${planHint(ctx)}</p>
      ${renderPlanSvg(zoneStates(ctx))}
    </div>
    ${zone ? renderSheet(ctx, zone) : ''}
  </div>`;
}

/* ---------- Suche und „Prüfen“ ---------- */

function renderSearch(ctx) {
  if (ctx.items.length === 0) {
    return emptyState('Nichts gefunden', `Kein Artikel enthält „${ctx.query}“. Andere Schreibweise oder ein Teilwort probieren.`);
  }
  const anyOnPlan = ctx.items.some((item) => item.zoneId);
  return groupBlock('Treffer', `${ctx.items.length} von ${ctx.inventory.counts.items}`, html`
    ${anyOnPlan ? html`<button class="btn planchip" data-show-plan>Alle Treffer im Schiffsplan zeigen</button>` : ''}
    ${itemList(ctx.items, { locate: true })}`);
}

function renderReview({ inventory }) {
  const { expired, expiring, restock } = reviewGroups(inventory.items);
  if (expired.length + expiring.length + restock.length === 0) {
    return emptyState('Alles in Ordnung', 'Kein Artikel läuft in den nächsten sechs Monaten ab, und kein Mindestbestand ist unterschritten.');
  }
  const block = (title, sub, items) => (items.length ? groupBlock(title, sub, itemList(items)) : '');
  return html`${block('Abgelaufen', `${expired.length} Artikel`, expired)}
    ${block('Läuft ab', `${expiring.length} in den nächsten 6 Monaten`, expiring)}
    ${block('Nachkaufen', `${restock.length} unter Mindestbestand`, restock)}`;
}
