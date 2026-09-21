import { html, raw } from './html.js';
import { PLAN_VIEWBOX, HULL_PATH, ZONES, DECOR } from './zones.js';

const LINE_HEIGHT = 14;

function zoneNode(zone, zoneState) {
  const classes = [
    'zone',
    zoneState.assigned ? 'is-assigned' : 'is-empty',
    zoneState.selected && 'is-selected',
    zoneState.hit && 'is-hit',
    zoneState.dim && 'is-dim',
  ].filter(Boolean).join(' ');

  const lines = zoneState.assigned ? [...zone.lines, String(zoneState.count)] : zone.lines;
  const firstLineY = zone.at[1] - ((lines.length - 1) * LINE_HEIGHT) / 2;
  const spoken = zoneState.assigned
    ? `${zone.label}, ${zoneState.count} Artikel`
    : `${zone.label}, kein Stauraum zugeordnet`;

  return html`<g class="${classes}" data-zone="${zone.id}" role="button" tabindex="0"
      aria-label="${spoken}" aria-pressed="${String(Boolean(zoneState.selected))}">
    <path d="${zone.d}"/>
    ${lines.map((line, index) => html`<text class="${index < zone.lines.length ? 'zone-name' : 'zone-count num'}"
      x="${zone.at[0]}" y="${firstLineY + index * LINE_HEIGHT}">${line}</text>`)}
  </g>`;
}

// zoneStates: Map von Zonen-ID auf { assigned, count, selected, hit, dim }.
export function renderPlanSvg(zoneStates) {
  return html`<svg class="plan" viewBox="${PLAN_VIEWBOX}" role="group" aria-label="Schiffsplan, Aufsicht, Bug oben">
    <defs><clipPath id="hull-clip"><path d="${HULL_PATH}"/></clipPath></defs>
    <path class="hull" d="${HULL_PATH}"/>
    <g clip-path="url(#hull-clip)">
      ${ZONES.map((zone) => zoneNode(zone, zoneStates.get(zone.id)))}
      ${raw(DECOR)}
    </g>
    <path class="hull-outline" d="${HULL_PATH}"/>
    <text class="plan-side" x="200" y="11">Bug</text>
    <text class="plan-side" x="26" y="1100" text-anchor="start">Backbord</text>
    <text class="plan-side" x="374" y="1100" text-anchor="end">Steuerbord</text>
  </svg>`;
}
