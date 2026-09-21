// Eigene Overlay-Komponente statt <dialog>: verhält sich auf iOS mit Tastatur und Scrollen
// berechenbar. Dazu Formular- und Rückfrage-Fenster sowie die kurze Meldung („Toast“).

import { html } from './html.js';

const stack = [];

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export const hasOverlay = () => stack.length > 0;

export function closeAllOverlays() {
  while (stack.length > 0) stack.at(-1).close();
}

// Zeigt panel über der App und liefert close(). Ohne `focus` bekommt das Fenster selbst den
// Fokus, damit beim Bearbeiten nicht sofort die Tastatur aufspringt.
export function showOverlay(panel, { dismissOnBackdrop = false, focus = null, onClose = null } = {}) {
  const element = document.createElement('div');
  element.className = 'overlay';
  element.append(panel);
  const entry = { element, close };

  function close() {
    const index = stack.indexOf(entry);
    if (index < 0) return;
    stack.splice(index, 1);
    element.remove();
    if (stack.length === 0) document.body.classList.remove('overlay-open');
    onClose?.();
  }

  element.addEventListener('click', (event) => {
    if (dismissOnBackdrop && event.target === element) close();
  });

  stack.push(entry);
  document.body.classList.add('overlay-open');
  document.body.append(element);
  panel.tabIndex = -1;
  (focus ? panel.querySelector(focus) : panel)?.focus({ preventScroll: true });
  return close;
}

document.addEventListener('keydown', (event) => {
  const top = stack.at(-1);
  if (!top) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    top.close();
  } else if (event.key === 'Tab') {
    const items = [...top.element.querySelectorAll(FOCUSABLE)].filter((item) => !item.hidden);
    if (items.length === 0) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === top.element.firstElementChild)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

// Formularfenster. onSubmit/onDelete dürfen werfen: die Meldung erscheint im Fenster und die
// Eingaben bleiben stehen. onDelete gibt false zurück, wenn der Nutzer die Rückfrage verneint.
export function showForm({ title, body, onSubmit, onDelete = null, submitLabel = 'Übernehmen' }) {
  const form = document.createElement('form');
  form.className = 'panel';
  form.setAttribute('role', 'dialog');
  form.setAttribute('aria-modal', 'true');
  form.setAttribute('aria-label', title);
  form.innerHTML = String(html`
    <div class="dlg-head"><h2>${title}</h2></div>
    <div class="dlg-body">${body}<p class="formerror" role="alert" hidden></p></div>
    <div class="dlg-foot">
      <button type="button" class="btn ghost" data-cancel>Abbrechen</button>
      ${onDelete ? html`<button type="button" class="btn danger" data-delete>Löschen</button>` : ''}
      <button type="submit" class="btn primary">${submitLabel}</button>
    </div>`);

  const close = showOverlay(form);
  const errorBox = form.querySelector('.formerror');
  const setBusy = (busy) => form.querySelectorAll('button').forEach((button) => { button.disabled = busy; });

  async function run(action) {
    errorBox.hidden = true;
    setBusy(true);
    try {
      const result = await action(form);
      if (result === false) {
        setBusy(false);
        return;
      }
      close();
    } catch (error) {
      errorBox.textContent = error?.message ?? String(error);
      errorBox.hidden = false;
      setBusy(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run(onSubmit);
  });
  form.querySelector('[data-cancel]').addEventListener('click', close);
  form.querySelector('[data-delete]')?.addEventListener('click', () => run(onDelete));
  return { form, close };
}

// Eine Mitteilung mit „Schließen“. body darf Markup sein (html`…`).
export function showMessage({ title, body }) {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', title);
  panel.innerHTML = String(html`
    <div class="dlg-head"><h2>${title}</h2></div>
    <div class="dlg-body">${body}</div>
    <div class="dlg-foot"><button type="button" class="btn primary" data-close>Schließen</button></div>`);
  const close = showOverlay(panel, { dismissOnBackdrop: true });
  panel.querySelector('[data-close]').addEventListener('click', close);
  return close;
}

export function confirmAction({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', title);
    panel.innerHTML = String(html`
      <div class="dlg-head"><h2>${title}</h2></div>
      <div class="dlg-body"><p class="confirmtext">${message}</p></div>
      <div class="dlg-foot">
        <button type="button" class="btn ghost" data-answer="no">Abbrechen</button>
        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-answer="yes">${confirmLabel}</button>
      </div>`);
    let settled = false;
    const settle = (answer) => {
      if (!settled) {
        settled = true;
        resolve(answer);
      }
    };
    const close = showOverlay(panel, { dismissOnBackdrop: true, focus: '[data-answer="no"]', onClose: () => settle(false) });
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('[data-answer]');
      if (!button) return;
      settle(button.dataset.answer === 'yes');
      close();
    });
  });
}

let toastTimer = null;

export function showToast(message) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.append(toast);
  toastTimer = setTimeout(() => toast.remove(), 3400);
}
