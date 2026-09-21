// Geometrie des Schiffsplans (Aufsicht, Bug oben, Backbord links), vereinfacht nach dem
// Deckplan der Hanse 345. Koordinaten im viewBox 0 0 400 1104.
// Ein Stauraum wird über sein Feld `zone` einem dieser Bereiche zugeordnet.

const rect = (x, y, width, height) => `M${x} ${y}h${width}v${height}h${-width}Z`;

export const PLAN_VIEWBOX = '0 0 400 1104';

export const HULL_PATH =
  'M200 18C120 130 46 330 26 600L26 940C26 1010 38 1050 56 1082L344 1082' +
  'C362 1050 374 1010 374 940L374 600C354 330 280 130 200 18Z';

// Jeder Bereich ist genau ein Stauraum. subdivision sagt, ob und wie er sich unterteilt:
//   'kisten'       nummerierte Kisten mit Ebene (nur die Backskiste Bb)
//   'unterteilung' frei benannte Teile ohne Nummer, z. B. „Mitte“ oder „Vorne“
//   (fehlt)        keine Unterteilung; der Bereich ist selbst der Stauraum, die Artikel liegen direkt darin
// Technisch sind beide Arten von Teilen Datensätze im Objektspeicher „boxes“.
// lines: Beschriftung im Plan; at: Mittelpunkt des Textblocks (Beschriftung plus Zähler).
export const ZONES = [
  { id: 'ankerkasten', label: 'Ankerkasten (an Deck)', lines: ['Anker-', 'kasten'], at: [200, 73], d: rect(100, 18, 200, 78) },
  { id: 'vkoje', label: 'V-Koje (Vorschiff)', lines: ['V-Koje'], at: [200, 215], d: 'M178 100L222 100L300 300L100 300Z' },
  { id: 'schrank-bb', label: 'Schrank vorn Backbord', lines: ['Schrank', 'Bb'], at: [103, 339], d: rect(70, 306, 66, 66) },
  { id: 'schrank-stb', label: 'Schrank vorn Steuerbord', lines: ['Schrank', 'Stb'], at: [297, 339], d: rect(264, 306, 66, 66) },
  { id: 'salon-schapp-bb', subdivision: 'unterteilung', label: 'Salon Schapp Backbord', lines: ['Salon', 'Schapp', 'Bb'], at: [64, 479], d: rect(10, 380, 76, 198) },
  { id: 'sofa-bb', subdivision: 'unterteilung', label: 'Salonsofa Backbord', lines: ['Sofa', 'Bb'], at: [113, 479], d: rect(86, 380, 52, 198) },
  { id: 'sofa-stb', subdivision: 'unterteilung', label: 'Salonsofa Steuerbord', lines: ['Sofa', 'Stb'], at: [278, 478], d: 'M252 380H304V619H216V577H252Z' },
  { id: 'salon-schapp-stb', subdivision: 'unterteilung', label: 'Salon Schapp Steuerbord', lines: ['Salon', 'Schapp', 'Stb'], at: [330, 499], d: rect(304, 380, 86, 239) },
  // Zwei kleine Fächer im Salontisch (Tisch: x 188–248, y 412–577), mittig übereinander.
  { id: 'tisch-oben', label: 'Tisch oben', lines: ['Tisch', 'oben'], at: [218, 458], d: rect(192, 428, 52, 60) },
  { id: 'tisch-unten', label: 'Tisch unten', lines: ['Tisch', 'unten'], at: [218, 530], d: rect(192, 500, 52, 60) },
  { id: 'navi', label: 'Navigationsplatz', lines: ['Navi'], at: [100, 616], d: rect(62, 584, 76, 64) },
  { id: 'pantry', subdivision: 'unterteilung', label: 'Pantry', lines: ['Pantry'], at: [305, 661], d: 'M236 627H374V804H326V695H236Z' },
  { id: 'nasszelle', label: 'Nasszelle', lines: ['Nasszelle'], at: [81, 762], d: rect(28, 654, 106, 144) },
  { id: 'backskiste', subdivision: 'kisten', label: 'Backskiste Backbord', lines: ['Backskiste', 'Bb'], at: [112, 908], d: 'M26 804H162V858H198V1012H26Z' },
  { id: 'achterkajuete', label: 'Achterkajüte Steuerbord', lines: ['Achterkajüte', 'Stb'], at: [260, 950], d: rect(204, 870, 170, 142) },
  { id: 'schrank-achter', label: 'Schrank Achterkajüte', lines: ['Schrank', 'Achter-', 'kajüte'], at: [341, 837], d: rect(308, 804, 66, 66) },
  // Deckstauraum, räumlich über der Achterkajüte; liegt im Plan auf ihr und wird darüber gezeichnet.
  { id: 'backskiste-stb', label: 'Backskiste Steuerbord (an Deck)', lines: ['Back-', 'skiste', 'Stb'], at: [344, 923], d: rect(316, 878, 56, 90) },
  { id: 'heck', label: 'Heckstauraum', lines: ['Heckstauraum'], at: [200, 1049], d: rect(26, 1018, 348, 62) },
];

export const ZONE_BY_ID = new Map(ZONES.map((zone) => [zone.id, zone]));
export const ZONE_IDS = new Set(ZONE_BY_ID.keys());
// Reihenfolge im Plan, von vorn nach hinten: so werden Stauräume sortiert.
export const ZONE_RANK = new Map(ZONES.map((zone, index) => [zone.id, index]));

// Nur zur Orientierung, nicht antippbar: Schotts, Tisch, Niedergang, Motorraum (kein Stauraum),
// Herd, Kissen, WC.
export const DECOR = `<g class="decor">
<path d="M66 376H178M222 376H334"/>
<rect x="188" y="412" width="60" height="165" rx="8"/>
<rect x="162" y="746" width="74" height="56" rx="4"/>
<rect x="162" y="802" width="74" height="56" rx="4"/><text class="decor-label" x="199" y="830">Motor</text><path d="M162 765H236M162 784H236"/>
<circle cx="350" cy="715" r="7"/><circle cx="350" cy="739" r="7"/>
<rect x="150" y="262" width="44" height="24" rx="10"/><rect x="206" y="262" width="44" height="24" rx="10"/>
<rect x="216" y="882" width="44" height="24" rx="10"/><rect x="266" y="882" width="44" height="24" rx="10"/>
<ellipse cx="66" cy="684" rx="15" ry="19"/>
<path d="M276 804H374"/><path d="M236 804V844M236 844A40 40 0 0 0 276 804"/>
</g>`;
