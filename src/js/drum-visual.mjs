// ===== drum-visual.mjs — render drum cross-section + summary =====

import { svgEl, IN_PER_MM } from './utils.mjs';

const FALLBACK_COLORS = {
  accent: { r: 44, g: 86, b: 163 },
  accentLight: { r: 237, g: 242, b: 255 },
  ink500: { r: 85, g: 99, b: 125 },
  ink700: { r: 47, g: 59, b: 84 },
  ink900: { r: 20, g: 34, b: 56 },
  paper: { r: 255, g: 255, b: 255 }
};

const FALLBACK_HEX = {
  accent: '#2c56a3',
  accentLight: '#edf2ff',
  ink500: '#55637d',
  ink700: '#2f3b54',
  ink900: '#142238',
  paper: '#ffffff'
};

const SVG_SIZE = 320;
const SVG_MARGIN = 26;

/**
 * Parse a CSS color string into RGB components.
 * Supports #rgb[a], #rrggbb[aa], and rgb()/rgba().
 * Returns fallback if parsing fails.
 */
function parseCssColor(value, fallback) {
  if (!value) return { ...fallback };
  const v = value.trim();
  if (!v) return { ...fallback };

  if (v.startsWith('#')) {
    const hex = v.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return { r, g, b };
      }
    } else if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return { r, g, b };
      }
    }
  } else {
    const match = v.match(/^rgba?\(([^)]+)\)$/i);
    if (match) {
      const parts = match[1].split(',').map(p => parseFloat(p.trim()))
        .filter((_, idx) => idx < 3);
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        return { r: clamp255(parts[0]), g: clamp255(parts[1]), b: clamp255(parts[2]) };
      }
    }
  }

  return { ...fallback };
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function cssVar(styles, name, fallbackHex) {
  const value = styles.getPropertyValue(name);
  return value && value.trim() ? value.trim() : fallbackHex;
}

function mixRgb(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: clamp255(a.r + (b.r - a.r) * k),
    g: clamp255(a.g + (b.g - a.g) * k),
    b: clamp255(a.b + (b.b - a.b) * k)
  };
}

function rgbToCss(rgb, alpha = 1) {
  const a = typeof alpha === 'number' ? Math.max(0, Math.min(1, alpha)) : 1;
  if (a < 1) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a.toFixed(3)})`;
  }
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function fmt(value, digits = 0) {
  if (!Number.isFinite(value)) return '–';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function emptyState(summaryEl, metricsEl, layersEl, titleEl, svg) {
  if (titleEl) titleEl.textContent = 'Winch drum cross-section (awaiting inputs)';
  if (svg) svg.setAttribute('aria-label', 'Winch drum cross-section awaiting inputs');
  if (summaryEl) summaryEl.textContent = 'Enter drum and cable inputs to view the drum visualization.';
  if (metricsEl) metricsEl.textContent = '';
  if (layersEl) layersEl.textContent = '';
  if (svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }
}

function createMetric(label, value) {
  const wrap = document.createElement('div');
  wrap.className = 'metric';
  const lab = document.createElement('div');
  lab.className = 'metric__label';
  lab.textContent = label;
  const val = document.createElement('div');
  val.className = 'metric__value';
  val.textContent = value;
  wrap.append(lab, val);
  return wrap;
}

function createLayerItem(color, label, value) {
  const li = document.createElement('li');
  li.className = 'drum-layer-list__item';
  const swatch = document.createElement('span');
  swatch.className = 'drum-layer-list__swatch';
  swatch.style.backgroundColor = color;
  const labelEl = document.createElement('span');
  labelEl.className = 'drum-layer-list__label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'drum-layer-list__value';
  valueEl.textContent = value;
  li.append(swatch, labelEl, valueEl);
  return li;
}

export function renderDrumVisualization(rows, summary, cfg, meta) {
  const svg = /** @type {SVGSVGElement|null} */ (document.getElementById('drum_visual_svg'));
  const summaryEl = /** @type {HTMLParagraphElement|null} */ (document.getElementById('drum_summary'));
  const metricsEl = /** @type {HTMLDivElement|null} */ (document.getElementById('drum_metrics'));
  const layerListEl = /** @type {HTMLOListElement|null} */ (document.getElementById('drum_layer_list'));
  const titleEl = /** @type {SVGTitleElement|null} */ (document.getElementById('drum_visual_title'));

  if (!svg || !summaryEl || !metricsEl || !layerListEl || !titleEl) return;

  if (!rows || !rows.length || !summary || !cfg) {
    emptyState(summaryEl, metricsEl, layerListEl, titleEl, svg);
    return;
  }

  const { total_layers, total_wraps, cable_len_m, full_drum_dia_in } = summary;
  const {
    cable_dia_mm,
    core_dia_in,
    flange_to_flange_in,
    lebus_thk_in
  } = cfg;

  const cable_dia_in = Math.max(0, (cable_dia_mm || 0) * IN_PER_MM);

  svg.setAttribute('viewBox', `0 0 ${SVG_SIZE} ${SVG_SIZE}`);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  metricsEl.textContent = '';
  layerListEl.textContent = '';

  const styles = getComputedStyle(document.documentElement);
  const accentRgb = parseCssColor(cssVar(styles, '--accent', FALLBACK_HEX.accent), FALLBACK_COLORS.accent);
  const accentLightRgb = parseCssColor(cssVar(styles, '--accent-light', FALLBACK_HEX.accentLight), FALLBACK_COLORS.accentLight);
  const ink500Rgb = parseCssColor(cssVar(styles, '--ink-500', FALLBACK_HEX.ink500), FALLBACK_COLORS.ink500);
  const ink700Rgb = parseCssColor(cssVar(styles, '--ink-700', FALLBACK_HEX.ink700), FALLBACK_COLORS.ink700);
  const ink900Rgb = parseCssColor(cssVar(styles, '--ink-900', FALLBACK_HEX.ink900), FALLBACK_COLORS.ink900);
  const paperRgb = parseCssColor(cssVar(styles, '--paper', FALLBACK_HEX.paper), FALLBACK_COLORS.paper);

  const uniqueLayers = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.layer_no)) continue;
    seen.add(row.layer_no);
    uniqueLayers.push({ layer_no: row.layer_no, outer_dia_in: row.layer_dia_in });
  }
  
  const derivedOuterRadiusIn = Math.max(0, (core_dia_in || 0) / 2 + (lebus_thk_in || 0) + cable_dia_in * uniqueLayers.length);
  const maxRadiusIn = Math.max(0, Math.max((full_drum_dia_in || 0) / 2, derivedOuterRadiusIn));
  const halfWidthIn = Math.max(0, (flange_to_flange_in || 0) / 2);
  const maxExtentHalfIn = Math.max(maxRadiusIn, halfWidthIn);
  const scale = maxExtentHalfIn > 0 ? (SVG_SIZE / 2 - SVG_MARGIN) / maxExtentHalfIn : 1;
  const center = SVG_SIZE / 2;
  const maxRadiusPx = Math.max(0, maxRadiusIn * scale);
  const halfWidthPx = Math.max(0, halfWidthIn * scale);
  const axisHorizontalExtent = Math.max(maxRadiusPx, halfWidthPx);
  const axisVerticalExtent = maxRadiusPx;

  const axisEls = [];
  if (maxRadiusPx > 0 || halfWidthPx > 0) {
    if (maxRadiusPx > 0) {
      const outerFill = mixRgb(accentLightRgb, paperRgb, 0.25);
      svg.appendChild(svgEl('circle', {
        cx: center,
        cy: center,
        r: maxRadiusPx.toFixed(2),
        fill: rgbToCss(outerFill, 0.9),
        stroke: rgbToCss(accentRgb, 0.4),
        'stroke-width': 2
      }));
    }

    const axisColor = rgbToCss(ink700Rgb, 0.18);
    axisEls.push(svgEl('line', {
      x1: (center - axisHorizontalExtent).toFixed(2),
      y1: center.toFixed(2),
      x2: (center + axisHorizontalExtent).toFixed(2),
      y2: center.toFixed(2),
      stroke: axisColor,
      'stroke-width': 1,
      'stroke-dasharray': '6 6'
    }));
    axisEls.push(svgEl('line', {
      x1: center.toFixed(2),
      y1: (center - axisVerticalExtent).toFixed(2),
      x2: center.toFixed(2),
      y2: (center + axisVerticalExtent).toFixed(2),
      stroke: axisColor,
      'stroke-width': 1,
      'stroke-dasharray': '6 6'
    }));
  }

  const coreRadius = Math.max(0, (core_dia_in || 0) / 2 * scale);
  const lebusOuterRadius = Math.max(0, (core_dia_in + 2 * (lebus_thk_in || 0)) / 2 * scale);
  const coreHeightPx = coreRadius * 2;
  const coreWidthPx = Math.max(0, (flange_to_flange_in || 0) * scale);

  const layerStyles = uniqueLayers.map((layer, idx) => {
    const t = uniqueLayers.length > 1 ? idx / (uniqueLayers.length - 1) : 0;
    const baseColor = mixRgb(accentRgb, accentLightRgb, 0.25 + 0.55 * t);
    const fillColor = mixRgb(baseColor, paperRgb, 0.55);
    const outerRadius = Math.max(0, (layer.outer_dia_in || 0) / 2 * scale);
    return {
      layer_no: layer.layer_no,
      outerRadius,
      fillColor: rgbToCss(fillColor, 0.82),
      strokeColor: rgbToCss(baseColor, 0.94)
    };
  });

  axisEls.forEach(el => svg.appendChild(el));

  const cableRadiusPx = cable_dia_in > 0 ? (cable_dia_in / 2) * scale : 0;
  const cablePitchPx = cable_dia_in > 0 ? cable_dia_in * scale : 0;
  const lebusOffsetPx = Math.max(0, (lebus_thk_in || 0) * scale);
  const rectTop = center - coreHeightPx / 2;
  const rectBottom = center + coreHeightPx / 2;
  const rectLeft = center - coreWidthPx / 2;
  const rectRight = rectLeft + coreWidthPx;
  
  const wrapsByLayer = new Map();
  for (const row of rows) {
    wrapsByLayer.set(row.layer_no, (wrapsByLayer.get(row.layer_no) || 0) + 1);
  }

  if (cableRadiusPx > 0 && cablePitchPx > 0 && coreWidthPx > 0) {
    uniqueLayers.forEach((layer, idx) => {
      const wraps = wrapsByLayer.get(layer.layer_no) || 0;
      if (wraps <= 0) return;
      const style = layerStyles[idx];
      const centerOffsetPx = lebusOffsetPx + cableRadiusPx + idx * cablePitchPx;
      const topY = rectTop - centerOffsetPx;
      const bottomY = rectBottom + centerOffsetPx;

      for (let w = 0; w < wraps; w++) {
        const cx = rectLeft + cableRadiusPx + w * cablePitchPx;
        if (cx - cableRadiusPx < rectLeft - 1e-3) continue;
        if (cx + cableRadiusPx > rectRight + 1e-3) continue;

        svg.appendChild(svgEl('circle', {
          cx: cx.toFixed(2),
          cy: topY.toFixed(2),
          r: cableRadiusPx.toFixed(2),
          fill: style.fillColor,
          stroke: style.strokeColor,
          'stroke-width': 1.4
        }));

        svg.appendChild(svgEl('circle', {
          cx: cx.toFixed(2),
          cy: bottomY.toFixed(2),
          r: cableRadiusPx.toFixed(2),
          fill: style.fillColor,
          stroke: style.strokeColor,
          'stroke-width': 1.4
        }));
      }
    });
  }

  // Core fill.
  if (coreRadius > 0 && coreWidthPx > 0) {
    svg.appendChild(svgEl('rect', {
      x: (center - coreWidthPx / 2).toFixed(2),
      y: (center - coreHeightPx / 2).toFixed(2),
      width: coreWidthPx.toFixed(2),
      height: coreHeightPx.toFixed(2),
      fill: rgbToCss(ink900Rgb, 0.5),
      stroke: rgbToCss(ink900Rgb, 0.7),
      'stroke-width': 1
    }));
  }

  // Metrics grid
  const cableLenDigits = cable_len_m >= 1000 ? 0 : cable_len_m >= 10 ? 1 : 2;
  const cableDiaDigits = cable_dia_mm >= 50 ? 0 : cable_dia_mm >= 10 ? 1 : 2;
  const metrics = [
    ['Cable on drum', `${fmt(cable_len_m, cableLenDigits)} m`],
    ['Cable Ø', `${fmt(cable_dia_mm, cableDiaDigits)} mm`],
    ['Layers', fmt(total_layers, 0)],
    ['Total wraps', fmt(total_wraps, 0)],
    ['Wraps / layer', meta && Number.isFinite(meta.wraps_per_layer_used) ? fmt(meta.wraps_per_layer_used, 1) : '–'],
    ['Full drum Ø', `${fmt(full_drum_dia_in, 2)} in`],
    ['Core Ø', `${fmt(core_dia_in, 2)} in`],
    ['Lebus liner', `${fmt(lebus_thk_in, 3)} in`],
    ['Flange-to-flange', `${fmt(flange_to_flange_in, 2)} in`]
  ];

  for (const [label, value] of metrics) {
    metricsEl.appendChild(createMetric(label, value));
  }

  // Wraps per layer list
  uniqueLayers.forEach((layer, idx) => {
    const wraps = wrapsByLayer.get(layer.layer_no) || 0;
    const style = layerStyles[idx];
    const label = `Layer ${layer.layer_no}`;
    const value = `${fmt(wraps, 0)} ${wraps === 1 ? 'wrap' : 'wraps'}`;
    const li = createLayerItem(style.strokeColor, label, value);
    const outerDiaIn = layer.outer_dia_in || 0;
    li.title = `Layer ${layer.layer_no}: outer diameter ${fmt(outerDiaIn, 2)} in`;
    layerListEl.appendChild(li);
  });

  // Summary & accessibility copy
  const layerWord = total_layers === 1 ? 'layer' : 'layers';
  const wrapWord = total_wraps === 1 ? 'wrap' : 'wraps';
  const summaryLine = `${fmt(cable_len_m, cableLenDigits)} m of ${fmt(cable_dia_mm, cableDiaDigits)} mm cable on ${fmt(total_layers, 0)} ${layerWord} with ${fmt(total_wraps, 0)} total ${wrapWord}`;
  const geometryParts = [
    `core Ø ${fmt(core_dia_in, 2)} in`,
    `flange-to-flange ${fmt(flange_to_flange_in, 2)} in`,
    `Lebus liner ${fmt(lebus_thk_in, 3)} in`,
    `full drum Ø ${fmt(full_drum_dia_in, 2)} in`
  ];
  const summaryPlain = `${summaryLine}. Drum geometry: ${geometryParts.join(', ')}.`;

  summaryEl.innerHTML = `<strong>${summaryLine}.</strong> Drum geometry: ${geometryParts.join(', ')}.`;
  titleEl.textContent = `Winch drum cross-section with ${fmt(total_layers, 0)} ${layerWord}`;
  svg.setAttribute('aria-label', summaryPlain);
}

export function clearDrumVisualization() {
  const svg = /** @type {SVGSVGElement|null} */ (document.getElementById('drum_visual_svg'));
  const summaryEl = /** @type {HTMLParagraphElement|null} */ (document.getElementById('drum_summary'));
  const metricsEl = /** @type {HTMLDivElement|null} */ (document.getElementById('drum_metrics'));
  const layerListEl = /** @type {HTMLOListElement|null} */ (document.getElementById('drum_layer_list'));
  const titleEl = /** @type {SVGTitleElement|null} */ (document.getElementById('drum_visual_title'));
  if (svg && summaryEl && metricsEl && layerListEl && titleEl) {
    emptyState(summaryEl, metricsEl, layerListEl, titleEl, svg);
  }
}