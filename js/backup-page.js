// Die HTML-Sicherung: eine vollständige, eigenständige Seite mit eingebetteten Daten und einer
// schlanken Nur-Lese-Suche. Sie läuft in jedem Browser, auch ohne diese App und in zehn Jahren.
// Die eingebetteten Daten lassen sich in der App wieder einlesen.

export const EMBEDDED_ID = 'bordinventar-daten';

// String.raw: Rückstriche stehen unverändert in der Seite. Kein Backtick und kein Dollar-Klammer-Paar
// hineinschreiben.
const STYLE = String.raw`
:root{color-scheme:light dark;--ground:#F1F3F1;--surface:#fff;--ink:#15201E;--muted:#5C6A68;--line:#D6DEDB;--accent:#0D5F63;--warn:#8C6104;--crit:#9E3226}
@media(prefers-color-scheme:dark){:root{--ground:#0D1413;--surface:#161F1E;--ink:#E7EEEC;--muted:#92A29F;--line:#2A3735;--accent:#58B9B4;--warn:#D9A648;--crit:#E58273}}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:820px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:0 0 2px}
.stand{color:var(--muted);font-size:14px;margin:0 0 12px}
input{width:100%;min-height:44px;padding:10px 12px;font-size:16px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:inherit}
h2{font-size:13px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:22px 2px 6px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.item{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;gap:12px;justify-content:space-between}
.name{font-weight:600}
.meta{font-size:13px;color:var(--muted)}
.qty{white-space:nowrap;font-weight:600;font-variant-numeric:tabular-nums}
.crit{color:var(--crit)}.warn{color:var(--warn)}
.note{font-size:13px;color:var(--muted);margin-top:24px}
`;

const SCRIPT = String.raw`
(function () {
  var data = JSON.parse(document.getElementById('bordinventar-daten').textContent);
  var locations = {}, boxes = {};
  data.locations.forEach(function (l) { locations[l.id] = l; });
  data.boxes.forEach(function (b) { boxes[b.id] = b; });
  var collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
  var now = new Date();
  var todayDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFC').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function daysLeft(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
    var p = iso.split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000 - todayDay);
  }
  function fmtDate(iso) { var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function fmtQty(n) { return String(Math.round(Number(n) * 100) / 100).replace('.', ','); }

  var items = data.items.map(function (item) {
    var loc = locations[item.locationId], box = item.boxId ? boxes[item.boxId] : null;
    var where = loc ? loc.name : 'ohne Stauraum';
    if (box && box.number == null) where += ' · ' + (box.label || 'Unterteilung');
    else if (box) where += ' · Kiste ' + box.number + (box.label ? ' · ' + box.label : '') + (box.shelf ? ' (' + box.shelf + ')' : '');
    return { item: item, loc: loc, where: where, hay: norm([item.name, item.category, item.note, where].join(' ')) };
  });

  function line(entry) {
    var it = entry.item, parts = [], d = daysLeft(it.expiry);
    parts.push(esc(entry.where));
    if (it.category) parts.push(esc(it.category));
    if (d !== null) {
      var cls = d < 0 ? 'crit' : d <= 60 ? 'crit' : d <= 180 ? 'warn' : '';
      var text = (d < 0 ? 'abgelaufen ' : 'bis ') + fmtDate(it.expiry);
      parts.push('<span class="' + cls + '">' + text + '</span>');
    }
    if (it.minQuantity != null && Number(it.quantity) < Number(it.minQuantity)) parts.push('<span class="warn">unter Mindestbestand</span>');
    return '<div class="item"><div><div class="name">' + esc(it.name) + '</div><div class="meta">' + parts.join(' · ') + '</div>' +
      (it.note ? '<div class="meta">' + esc(it.note) + '</div>' : '') + '</div>' +
      '<div class="qty">' + fmtQty(it.quantity) + (it.unit ? ' ' + esc(it.unit) : '') + '</div></div>';
  }

  function render(query) {
    var tokens = norm(query).split(' ').filter(Boolean);
    var hits = items.filter(function (e) { return tokens.every(function (t) { return e.hay.indexOf(t) >= 0; }); });
    hits.sort(function (a, b) { return collator.compare(a.where, b.where) || collator.compare(a.item.name, b.item.name); });
    var out = '', last = null;
    hits.forEach(function (e) {
      var head = e.loc ? e.loc.name : 'Ohne Stauraum';
      if (head !== last) { out += '<h2>' + esc(head) + '</h2>'; last = head; }
      out += line(e);
    });
    document.getElementById('list').innerHTML = out || '<p class="meta">Nichts gefunden.</p>';
    document.getElementById('count').textContent = hits.length + ' von ' + items.length + ' Artikeln';
  }

  var box = document.getElementById('q');
  box.addEventListener('input', function () { render(box.value); });
  render('');
})();
`;

const formatStamp = (iso) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (character) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function buildBackupPage(payload) {
  // „<“ maskieren, damit ein Artikelname wie „</script>“ die Seite nicht zerreißt.
  const data = JSON.stringify(payload).replace(/</g, '\\u003c');
  const day = `${formatStamp(payload.exportedAt)} Uhr`;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bordinventar – Sicherung vom ${escapeHtml(day)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>Bordinventar</h1>
<p class="stand">Sicherung vom ${escapeHtml(day)} · <span id="count"></span></p>
<input id="q" type="search" placeholder="Wo ist … ? Impeller, Leuchtkugeln, Schäkel" autocomplete="off" aria-label="Suche">
<div id="list"></div>
<p class="note">Nur-Lese-Ansicht. Bearbeiten geht in der Bordinventar-App; diese Datei lässt sich dort über „Sicherung einlesen“ wieder einlesen.</p>
</main>
<script type="application/json" id="${EMBEDDED_ID}">${data}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
