// Das Menü (⋮): zusätzliche Stauräume, Sicherung und Import, Beispieleinträge, Kurzanleitung.

import { html } from './html.js';
import * as store from './store.js';
import { showOverlay, showMessage, confirmAction, showToast } from './overlay.js';
import { openLocationDialog } from './dialogs.js';
import { buildExports, collectData, deliverFile, importBackup } from './exchange.js';
import { formatTimestamp } from './model.js';
import { ZONES } from './zones.js';

const FILE_ACTIONS = { 'export-html': 'html', 'export-json': 'json', 'export-csv': 'csv' };
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// hooks: { getData(), flush(), refresh() }
let hooks = null;

export function initMenu(options) {
  hooks = options;
  const input = document.getElementById('importfile');
  input.addEventListener('change', async () => {
    const [file] = input.files;
    input.value = ''; // Dieselbe Datei soll sich danach erneut wählen lassen.
    if (file) await runImport(file);
  });
}

const formatClock = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

async function runImport(file) {
  try {
    await hooks.flush();
    const stats = await importBackup(file);
    await store.ensureZoneLocations(ZONES);
    await hooks.refresh();
    showMessage({
      title: stats.exportedAt ? `Sicherung vom ${formatTimestamp(stats.exportedAt)}, ${formatClock(stats.exportedAt)} Uhr eingelesen` : 'Sicherung eingelesen',
      body: html`<p class="confirmtext"><strong>${plural(stats.added, 'neu', 'neu')}</strong> · <strong>${stats.changed} geändert</strong> ·
        <strong>${stats.removed} gelöscht</strong> · ${stats.unchanged} unverändert${stats.skipped ? html` · ${stats.skipped} ungültige übersprungen` : ''}.</p>
        <p class="fieldnote">Der Bestand auf diesem Gerät wurde mit der Sicherung zusammengeführt: Je Eintrag gilt die jüngere Fassung, auch beim Löschen.</p>`,
    });
  } catch (error) {
    showMessage({ title: 'Einlesen nicht möglich', body: html`<p class="confirmtext">${error?.message ?? String(error)}</p>` });
  }
}

async function removeExamples() {
  const examples = hooks.getData().items.filter((item) => item.isExample);
  const confirmed = await confirmAction({
    title: 'Beispieleinträge entfernen?',
    message: `${plural(examples.length, 'Beispielartikel wird', 'Beispielartikel werden')} gelöscht.`,
    confirmLabel: 'Entfernen',
  });
  if (!confirmed) return;
  await hooks.flush();
  await store.commit({ deletes: { items: examples.map((item) => item.id) } });
  await hooks.refresh();
  showToast(`${plural(examples.length, 'Beispieleintrag', 'Beispieleinträge')} entfernt.`);
}

function showHelp() {
  showMessage({
    title: 'Kurzanleitung',
    body: html`<div class="help">
      <h3>Wo liegen die Daten?</h3>
      <p>Nur auf diesem Gerät, im Speicher der App. Es gibt kein Konto und keinen Server. Die App vom Home-Bildschirm und Safari haben getrennte Daten, ebenso iPhone und Mac.</p>
      <h3>Sichern</h3>
      <p>Menü, dann „Sicherung als JSON“. Am iPhone öffnet sich das Teilen-Menü, dort „In Dateien sichern“. Am Mac wird die Datei geladen. „Sicherung als HTML“ ist ein Archiv, das sich in jedem Browser öffnen und durchsuchen lässt.</p>
      <h3>Abgleichen</h3>
      <p>Am einen Gerät die JSON-Sicherung anlegen, am anderen „Sicherung einlesen“. Das führt zusammen, statt zu ersetzen: Je Eintrag gewinnt die jüngere Fassung, auch beim Löschen. Für beide Richtungen wiederholen. Es geht nichts verloren, was neuer ist.</p>
      <h3>Installieren</h3>
      <p>iPhone: In Safari „Teilen“, „Zum Home-Bildschirm“. Mac: In Safari „Ablage“, „Zum Dock hinzufügen“. Danach läuft die App auch ohne Netz.</p>
    </div>`,
  });
}

// Die Dateien liegen fertig vor, bevor das Menü aufgeht: iOS öffnet das Teilen-Menü nur, wenn
// es direkt im Tipp-Ereignis angefordert wird.
export async function openMenu() {
  await hooks.flush();
  const files = buildExports(await collectData());
  const exampleCount = hooks.getData().items.filter((item) => item.isExample).length;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Menü');
  panel.innerHTML = String(html`
    <div class="dlg-head"><h2>Inventar verwalten</h2></div>
    <div class="dlg-body menubody">
      <button type="button" class="menuitem" data-menu-action="location">Stauraum anlegen<small>Zusätzlicher Ort ohne Position im Schiffsplan</small></button>
      <button type="button" class="menuitem" data-menu-action="export-html">Sicherung als HTML<small>Archiv zum Lesen und Durchsuchen in jedem Browser</small></button>
      <button type="button" class="menuitem" data-menu-action="export-json">Sicherung als JSON<small>Vollständig, zum Einlesen und für den Abgleich</small></button>
      <button type="button" class="menuitem" data-menu-action="export-csv">Liste als CSV<small>Zum Öffnen in Numbers oder Excel</small></button>
      <button type="button" class="menuitem" data-menu-action="import">Sicherung einlesen<small>JSON- oder HTML-Sicherung, führt mit dem Bestand zusammen</small></button>
      <button type="button" class="menuitem" data-menu-action="examples" ${exampleCount ? '' : 'disabled'}>Beispieleinträge entfernen<small>${exampleCount ? `${plural(exampleCount, 'Musterartikel', 'Musterartikel')} löschen` : 'Keine vorhanden'}</small></button>
      <button type="button" class="menuitem" data-menu-action="help">Kurzanleitung<small>Sichern, abgleichen, installieren</small></button>
    </div>
    <div class="dlg-foot"><button type="button" class="btn primary" data-menu-action="close">Schließen</button></div>`);
  const close = showOverlay(panel, { dismissOnBackdrop: true });

  panel.addEventListener('click', (event) => {
    const action = event.target.closest('[data-menu-action]')?.dataset.menuAction;
    if (!action) return;

    if (action in FILE_ACTIONS) {
      const delivery = deliverFile(files[FILE_ACTIONS[action]]); // zuerst und ohne await, siehe oben
      close();
      delivery.then((how) => {
        if (how === 'downloaded') showToast('Datei geladen, siehe Ordner „Downloads“.');
        else if (how === 'shared') showToast('Sicherung übergeben.');
      }).catch((error) => showToast(error?.message ?? 'Die Datei konnte nicht ausgegeben werden.'));
      return;
    }
    if (action === 'import') {
      close();
      document.getElementById('importfile').click(); // ebenfalls direkt im Tipp-Ereignis
      return;
    }
    close();
    if (action === 'location') openLocationDialog();
    else if (action === 'examples') removeExamples().catch((error) => showToast(error.message));
    else if (action === 'help') showHelp();
  });
}
