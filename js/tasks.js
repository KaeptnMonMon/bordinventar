// Aufgaben: Reparaturen, Projekte und Termine, unabhängig vom Inventar. Eigene kleine Datenschicht
// über store.js, eigene Ansicht, eigener Dialog – damit dialogs.js und views.js nicht wachsen.
//
// save()/commitChanges() sind absichtlich eine eigene, kleine Kopie der Helfer aus dialogs.js:
// das hält diese Datei unabhängig, statt die Inventar-Dialoge mit Aufgaben zu koppeln.

import { html, raw } from './html.js';
import * as store from './store.js';
import { showForm, confirmAction, showToast } from './overlay.js';
import { daysUntil, formatDate, todayIso } from './model.js';

const DUE_WARNING_DAYS = 14;
const CHECK_ICON = raw('<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.5"/></svg>');
const TRASH_ICON = raw('<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h12M7 5V3.5h4V5M5 5l.6 9.5h6.8L13 5M7.6 8v4.2M10.4 8v4.2"/></svg>');

// hooks: { getData(), flush(), refresh() } – dieselbe Form wie bei dialogs.js.
let hooks = null;
export function initTasks(options) {
  hooks = options;
}

/* ---------- Ableitung ---------- */

function decorate(task, today) {
  const daysLeft = daysUntil(task.dueDate, today);
  return { ...task, daysLeft, overdue: daysLeft !== null && daysLeft < 0 };
}

const byDue = (a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99')
  || (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '');
const byDoneDate = (a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '');

// Aus den Rohdaten des Objektspeichers „tasks“, was die Ansicht braucht: offen zuerst nach
// Fälligkeit, ohne Datum danach in der Reihenfolge des Anlegens; erledigt zuletzt erledigt zuerst.
export function buildTasks(tasks, today = todayIso()) {
  const decorated = tasks.map((task) => decorate(task, today));
  return {
    open: decorated.filter((task) => !task.done).sort(byDue),
    done: decorated.filter((task) => task.done).sort(byDoneDate),
  };
}

/* ---------- Ansicht ---------- */

function dueBadge(task) {
  if (!task.dueDate) return '';
  const date = formatDate(task.dueDate);
  if (task.overdue) return html`<span class="badge crit">fällig seit ${date}</span>`;
  if (task.daysLeft <= DUE_WARNING_DAYS) return html`<span class="badge warn">fällig ${date}</span>`;
  return html`<span class="badge">fällig ${date}</span>`;
}

function taskRow(task) {
  const meta = !task.done && (task.dueDate || task.note);
  return html`<div class="row taskrow${task.done ? ' is-done' : ''}">
    <button type="button" class="taskcheck" data-toggle-task="${task.id}" aria-pressed="${String(task.done)}"
      aria-label="${task.done ? 'Wieder öffnen' : 'Erledigt'}: ${task.title}">${task.done ? CHECK_ICON : ''}</button>
    <button type="button" class="taskmain" data-edit-task="${task.id}">
      <span class="rowname">${task.title}</span>
      ${meta ? html`<span class="rowmeta">${dueBadge(task)}${task.note ? html`<span class="tasknote">${task.note}</span>` : ''}</span>` : ''}
    </button>
    <button type="button" class="trashbtn" data-delete-task="${task.id}" aria-label="Löschen: ${task.title}">${TRASH_ICON}</button>
  </div>`;
}

// ctx.tasks: { open, done } aus buildTasks(); ctx.showDone: ob der Erledigt-Block aufgeklappt ist.
export function renderTasksTab(ctx) {
  const { open, done } = ctx.tasks;
  const list = open.length
    ? html`<div class="list">${open.map(taskRow)}</div>`
    : html`<div class="empty"><strong>Keine offenen Aufgaben</strong>Oben eintippen oder diktieren und mit Return anlegen.</div>`;
  if (done.length === 0) return list;

  if (!ctx.showDone) {
    return html`${list}<button type="button" class="btn ghost morebtn" data-toggle-done>${done.length} erledigte ${done.length === 1 ? 'Aufgabe' : 'Aufgaben'} anzeigen</button>`;
  }
  return html`${list}
    <div class="group">
      <div class="grouphead"><h2>Erledigt</h2><span class="sub">${done.length}</span></div>
      <div class="list">${done.map(taskRow)}</div>
      <div class="rowactions">
        <button type="button" class="btn ghost" data-toggle-done>Einklappen</button>
        <button type="button" class="btn ghost" data-clear-done>Erledigte löschen</button>
      </div>
    </div>`;
}

/* ---------- Schreiben ---------- */

const field = (id, label, control) => html`<div class="field"><label for="${id}">${label}</label>${control}</div>`;

async function save(record, message) {
  await hooks.flush();
  await store.putRecord('tasks', record);
  await hooks.refresh();
  showToast(message);
}

async function commitChanges(changes, message) {
  await hooks.flush();
  await store.commit(changes);
  await hooks.refresh();
  showToast(message);
}

// Schnelleingabe aus der Kopfzeile: nur der Titel, zum Diktieren und sofort weiter.
export async function addQuickTask(title) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await save({ title: trimmed }, `„${trimmed}“ angelegt.`);
}

export async function toggleTaskDone(taskId) {
  const task = hooks.getData().tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  const done = !task.done;
  await save({ ...task, done, completedAt: done ? new Date().toISOString() : null }, done ? 'Erledigt.' : 'Wieder geöffnet.');
}

export async function deleteTask(taskId) {
  const task = hooks.getData().tasks.find((candidate) => candidate.id === taskId);
  if (!task) return false;
  const confirmed = await confirmAction({ title: 'Aufgabe löschen?', message: `„${task.title}“ wird gelöscht.`, confirmLabel: 'Löschen' });
  if (!confirmed) return false;
  await commitChanges({ deletes: { tasks: [task.id] } }, `„${task.title}“ gelöscht.`);
  return true;
}

export async function clearDoneTasks() {
  const done = hooks.getData().tasks.filter((task) => task.done);
  if (done.length === 0) return;
  const confirmed = await confirmAction({
    title: 'Erledigte Aufgaben löschen?',
    message: `${done.length} erledigte ${done.length === 1 ? 'Aufgabe wird' : 'Aufgaben werden'} endgültig gelöscht.`,
    confirmLabel: 'Löschen',
  });
  if (!confirmed) return;
  await commitChanges({ deletes: { tasks: done.map((task) => task.id) } }, 'Erledigte Aufgaben gelöscht.');
}

export function openTaskDialog({ taskId = null } = {}) {
  const task = taskId ? hooks.getData().tasks.find((candidate) => candidate.id === taskId) : null;
  if (taskId && !task) return;

  const body = html`
    ${field('t-title', 'Aufgabe', html`<input id="t-title" name="title" required autocomplete="off" placeholder="z. B. Umlenkrolle Fockschot reparieren" value="${task?.title ?? ''}">`)}
    ${field('t-due', 'Fällig am', html`<span class="inputwrap"><input id="t-due" name="dueDate" type="date" autocomplete="off" value="${task?.dueDate ?? ''}"><button type="button" class="inputclear" data-clear-date aria-label="Datum entfernen" hidden>×</button></span>`)}
    ${field('t-note', 'Notiz', html`<textarea id="t-note" name="note" placeholder="Einzelheiten, Maße, Ansprechpartner …">${task?.note ?? ''}</textarea>`)}`;

  const { form } = showForm({
    title: task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe',
    body,
    onSubmit: async (formElement) => {
      const values = new FormData(formElement);
      const title = String(values.get('title')).trim();
      if (!title) throw new Error('Bitte eine Aufgabe eingeben.');
      await save({
        ...task,
        title,
        dueDate: String(values.get('dueDate')),
        note: String(values.get('note')).trim(),
      }, task ? 'Übernommen.' : `„${title}“ angelegt.`);
    },
    onDelete: task && (() => deleteTask(task.id)),
  });
  if (!task) form.elements.title.focus();

  // iOS bietet in Datumsfeldern kein „Leeren“ an; deshalb ein eigener Knopf (wie beim Artikel).
  const dateInput = form.elements.dueDate;
  const clearDate = form.querySelector('[data-clear-date]');
  const syncClear = () => { clearDate.hidden = dateInput.value === ''; };
  dateInput.addEventListener('input', syncClear);
  dateInput.addEventListener('change', syncClear);
  clearDate.addEventListener('click', () => { dateInput.value = ''; syncClear(); });
  syncClear();
}
