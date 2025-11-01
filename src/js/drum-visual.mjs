// ===== drum-visual.mjs â€” render drum cross-section + summary =====

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

const SVG_BASE_HEIGHT = 360;
const SVG_MARGIN = 28;

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

function emptyState(summaryEl, titleEl, svg) {
  if (titleEl) titleEl.textContent = 'Winch drum cross-section (awaiting inputs)';
  if (svg) svg.setAttribute('aria-label', 'Winch drum cross-section awaiting inputs');
  if (summaryEl) summaryEl.textContent = 'Enter drum and cable inputs to view the drum visualization.';
  if (svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }
}

export function renderDrumVisualization(rows, summary, cfg, meta) {
  const svg = /** @type {SVGSVGElement|null} */ (document.getElementById('drum_visual_svg'));
  const summaryEl = /** @type {HTMLParagraphElement|null} */ (document.getElementById('drum_summary'));
  const titleEl = /** @type {SVGTitleElement|null} */ (document.getElementById('drum_visual_title'));

  if (!svg || !summaryEl || !titleEl) return;

  if (!rows || !rows.length || !summary || !cfg) {
    emptyState(summaryEl, titleEl, svg);
    return;
  }

  const { total_layers, total_wraps, cable_len_m, full_drum_dia_in } = summary;
  const {
    cable_dia_mm,
    core_dia_in,
    flange_dia_in,
    flange_to_flange_in,
    lebus_thk_in,
    packing_factor
  } = cfg;

  const cable_dia_in = Math.max(0, (cable_dia_mm || 0) * IN_PER_MM);
  const packingFactor = Number.isFinite(packing_factor) ? Math.max(packing_factor, 0) : 0.877;

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const styles = getComputedStyle(document.documentElement);
  const accentRgb = parseCssColor(cssVar(styles, '--accent', FALLBACK_HEX.accent), FALLBACK_COLORS.accent);
  const ink700Rgb = parseCssColor(cssVar(styles, '--ink-700', FALLBACK_HEX.ink700), FALLBACK_COLORS.ink700);
  const ink900Rgb = parseCssColor(cssVar(styles, '--ink-900', FALLBACK_HEX.ink900), FALLBACK_COLORS.ink900);
  const paperRgb = parseCssColor(cssVar(styles, '--paper', FALLBACK_HEX.paper), FALLBACK_COLORS.paper);
  const cableFillCss = rgbToCss(mixRgb(accentRgb, paperRgb, 0.45), 0.82);
  const cableStrokeCss = rgbToCss(accentRgb, 0.94);

  const uniqueLayers = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.layer_no)) continue;
    seen.add(row.layer_no);
    uniqueLayers.push({ layer_no: row.layer_no });
  }

  const baseRadiusIn = Math.max(0,
    (core_dia_in || 0) / 2 +
    (lebus_thk_in || 0) +
    (cable_dia_in > 0 ? cable_dia_in / 2 : 0)
  );

  const layersForViz = uniqueLayers.map(layer => {
    const zeroBased = Math.max(0, layer.layer_no - 1);
    const centerRadiusIn = baseRadiusIn + zeroBased * cable_dia_in * packingFactor;
    return {
      layer_no: layer.layer_no,
      center_radius_in: centerRadiusIn,
      fillColor: cableFillCss,
      strokeColor: cableStrokeCss
    };
  });

  const maxCenterRadiusIn = layersForViz.length
    ? layersForViz.reduce((max, layer) => Math.max(max, layer.center_radius_in), 0)
    : baseRadiusIn;
  const derivedOuterRadiusIn = maxCenterRadiusIn + (cable_dia_in > 0 ? cable_dia_in / 2 : 0);
  const summaryOuterDiaIn = Number.isFinite(full_drum_dia_in)
    ? full_drum_dia_in + (cable_dia_in || 0)
    : 0;
  const outerDiaIn = Math.max(
    summaryOuterDiaIn,
    derivedOuterRadiusIn * 2,
    core_dia_in || 0,
    cable_dia_in || 0,
    1
  );
  const heightIn = outerDiaIn;
  const scale = heightIn > 0 ? (SVG_BASE_HEIGHT - 2 * SVG_MARGIN) / heightIn : 1;
  const widthIn = Math.max(flange_to_flange_in || 0, cable_dia_in || 0, 1);
  const widthPx = widthIn * scale;
  const heightPx = heightIn * scale;
  const viewWidth = widthPx + SVG_MARGIN * 2;
  const viewHeight = heightPx + SVG_MARGIN * 2;

  svg.setAttribute('viewBox', `0 0 ${viewWidth.toFixed(2)} ${viewHeight.toFixed(2)}`);

  const spoolLeft = SVG_MARGIN;
  const spoolRight = spoolLeft + widthPx;
  const centerY = SVG_MARGIN + heightPx / 2;

  const coreHeightPx = Math.max(0, (core_dia_in || 0) * scale);
  const coreWidthPx = Math.max(0, (flange_to_flange_in || 0) * scale);
  const flangeDiaIn = Math.max(0, flange_dia_in || 0);
  const flangeHeightPx = flangeDiaIn * scale;
  const flangeWidthPx = flangeDiaIn * 0.01 * scale;

  const strokeWidth = 0.85;
  const strokeWidthAttr = strokeWidth.toFixed(3);

  let coreStrokeColor = null;
  if (coreHeightPx > 0 && coreWidthPx > 0) {
    coreStrokeColor = rgbToCss(ink900Rgb, 0.72);
    svg.appendChild(svgEl('rect', {
      x: spoolLeft.toFixed(2),
      y: (centerY - coreHeightPx / 2).toFixed(2),
      width: coreWidthPx.toFixed(2),
      height: coreHeightPx.toFixed(2),
      fill: 'none',
      stroke: coreStrokeColor,
      'stroke-width': strokeWidthAttr,
      'vector-effect': 'non-scaling-stroke'
    }));
  }

  if (flangeHeightPx > 0 && flangeWidthPx > 0) {
    const flangeStrokeColor = coreStrokeColor ?? rgbToCss(ink900Rgb, 0.72);
    const flangeRectAttrs = {
      y: (centerY - flangeHeightPx / 2).toFixed(2),
      width: flangeWidthPx.toFixed(2),
      height: flangeHeightPx.toFixed(2),
      fill: 'none',
      stroke: flangeStrokeColor,
      'stroke-width': strokeWidthAttr,
      'vector-effect': 'non-scaling-stroke'
    };

    svg.appendChild(svgEl('rect', {
      ...flangeRectAttrs,
      x: (spoolLeft - flangeWidthPx).toFixed(2)
    }));

    svg.appendChild(svgEl('rect', {
      ...flangeRectAttrs,
      x: spoolRight.toFixed(2)
    }));
  }

  const axisColor = rgbToCss(ink700Rgb, 0.18);
  svg.appendChild(svgEl('line', {
    x1: spoolLeft.toFixed(2),
    y1: centerY.toFixed(2),
    x2: spoolRight.toFixed(2),
    y2: centerY.toFixed(2),
    stroke: axisColor,
    'stroke-width': strokeWidthAttr,
    'vector-effect': 'non-scaling-stroke',
    'stroke-dasharray': '6 6'
  }));

  const cableRadiusPx = cable_dia_in > 0 ? (cable_dia_in / 2) * scale : 0;
  const cablePitchPx = cable_dia_in > 0 ? cable_dia_in * scale : 0;

  const wrapsByLayer = new Map();
  for (const row of rows) {
    wrapsByLayer.set(row.layer_no, (wrapsByLayer.get(row.layer_no) || 0) + 1);
  }

  if (cableRadiusPx > 0 && cablePitchPx > 0 && coreWidthPx > 0) {
    layersForViz.forEach(layer => {
      const wraps = wrapsByLayer.get(layer.layer_no) || 0;
      if (wraps <= 0) return;
      const centerOffsetPx = layer.center_radius_in * scale;
      const layerPhasePx = (layer.layer_no % 2 === 0) ? cablePitchPx / 2 : 0;
      const topY = centerY - centerOffsetPx;
      const bottomY = centerY + centerOffsetPx;

      for (let w = 0; w < wraps; w++) {
        const cx = spoolLeft + cableRadiusPx + layerPhasePx + w * cablePitchPx;
        if (cx - cableRadiusPx < spoolLeft - 1e-3) continue;
        if (cx + cableRadiusPx > spoolRight + 1e-3) continue;

        svg.appendChild(svgEl('circle', {
          cx: cx.toFixed(2),
          cy: topY.toFixed(2),
          r: cableRadiusPx.toFixed(2),
          fill: layer.fillColor,
          stroke: layer.strokeColor,
          'stroke-width': strokeWidthAttr,
          'vector-effect': 'non-scaling-stroke'
        }));

        svg.appendChild(svgEl('circle', {
          cx: cx.toFixed(2),
          cy: bottomY.toFixed(2),
          r: cableRadiusPx.toFixed(2),
          fill: layer.fillColor,
          stroke: layer.strokeColor,
          'stroke-width': strokeWidthAttr,
          'vector-effect': 'non-scaling-stroke'
        }));
      }
    });
  }

  // Summary & accessibility copy
  const cableLenDigits = cable_len_m >= 1000 ? 0 : cable_len_m >= 10 ? 1 : 2;
  const cableDiaDigits = cable_dia_mm >= 50 ? 0 : cable_dia_mm >= 10 ? 1 : 2;
  const layerWord = total_layers === 1 ? 'layer' : 'layers';
  const wrapWord = total_wraps === 1 ? 'wrap' : 'wraps';
  const summaryLine = `${fmt(cable_len_m, cableLenDigits)} m of ${fmt(cable_dia_mm, cableDiaDigits)} mm cable on ${fmt(total_layers, 0)} ${layerWord} with ${fmt(total_wraps, 0)} total ${wrapWord}`;
  const wrapsPerLayer = meta && Number.isFinite(meta.wraps_per_layer_used)
    ? ` (≈${fmt(meta.wraps_per_layer_used, 1)} wraps per layer)`
    : '';
  const geometryParts = [
    `core Ø ${fmt(core_dia_in, 2)} in`,
    `flange-to-flange ${fmt(flange_to_flange_in, 2)} in`,
    `flange Ø ${fmt(flange_dia_in, 2)} in`,
    `Lebus liner ${fmt(lebus_thk_in, 3)} in`,
    `full drum Ø ${fmt(full_drum_dia_in, 2)} in`
  ];
  const geometryLine = `Drum geometry: ${geometryParts.join(', ')}.`;
  const summaryPlain = `${summaryLine}${wrapsPerLayer}. ${geometryLine}`;

  summaryEl.innerHTML = `<strong>${summaryLine}${wrapsPerLayer}.</strong> ${geometryLine}`;
  titleEl.textContent = `Winch drum cross-section with ${fmt(total_layers, 0)} ${layerWord}`;
  svg.setAttribute('aria-label', summaryPlain);
}

export function clearDrumVisualization() {
  const svg = /** @type {SVGSVGElement|null} */ (document.getElementById('drum_visual_svg'));
  const summaryEl = /** @type {HTMLParagraphElement|null} */ (document.getElementById('drum_summary'));
  const titleEl = /** @type {SVGTitleElement|null} */ (document.getElementById('drum_visual_title'));
  if (svg && summaryEl && titleEl) {
    emptyState(summaryEl, titleEl, svg);
  }
}
