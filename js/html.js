// Kleiner Template-Helfer: html`…` maskiert jeden eingesetzten Wert, außer er stammt
// selbst aus html`…`. Artikelnamen aus einem importierten Backup dürfen kein Markup einschleusen.

class Markup {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function fragment(value) {
  if (value instanceof Markup) return value.value;
  if (Array.isArray(value)) return value.map(fragment).join('');
  if (value === null || value === undefined || value === false) return '';
  return String(value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

export function html(strings, ...values) {
  return new Markup(strings.reduce((output, part, index) => output + fragment(values[index - 1]) + part));
}

// Nur für feste, im Code stehende Fragmente (z. B. Icons), nie für Nutzerdaten.
export const raw = (value) => new Markup(String(value));
