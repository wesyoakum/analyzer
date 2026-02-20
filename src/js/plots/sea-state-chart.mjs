const g = 9.80665;
const X_MIN = 2;
const X_MAX = 18;
const Y_MIN = 0;
const Y_MAX = 12;

const regions = [
  { ss: 3, tp: [3, 6], hs: [0.5, 1.25], color: 'rgba(80,120,255,0.25)' },
  { ss: 4, tp: [5, 8], hs: [1.25, 2.5], color: 'rgba(255,160,80,0.25)' },
  { ss: 5, tp: [6, 10], hs: [2.5, 4], color: 'rgba(120,220,140,0.25)' },
  { ss: 6, tp: [8, 14], hs: [4, 6], color: 'rgba(255,90,110,0.23)' },
  { ss: 7, tp: [10, 16], hs: [6, 9], color: 'rgba(170,120,255,0.23)' }
];

function byId(id) {
  return document.getElementById(id);
}

export function setupSeaStateChart() {
  const canvas = /** @type {HTMLCanvasElement|null} */ (byId('sea-state-canvas'));
  const tooltip = /** @type {HTMLElement|null} */ (byId('sea-state-tooltip'));
  if (!canvas || !tooltip) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const toggleRegions = /** @type {HTMLInputElement|null} */ (byId('sea-toggle-regions'));
  const toggleGrid = /** @type {HTMLInputElement|null} */ (byId('sea-toggle-grid'));
  const toggleSnap = /** @type {HTMLInputElement|null} */ (byId('sea-toggle-snap'));
  const toggleBreaking = /** @type {HTMLInputElement|null} */ (byId('sea-toggle-breaking'));
  const togglePM = /** @type {HTMLInputElement|null} */ (byId('sea-toggle-pm'));
  const clearPinsBtn = /** @type {HTMLButtonElement|null} */ (byId('sea-clear-pins'));
  const pinsBody = /** @type {HTMLElement|null} */ (byId('sea-pins-body'));
  const legend = /** @type {HTMLElement|null} */ (byId('sea-state-legend'));

  if (!toggleRegions || !toggleGrid || !toggleSnap || !toggleBreaking || !togglePM || !clearPinsBtn || !pinsBody || !legend) return;

  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const M = { l: 70, r: 18, t: 18, b: 52 };

  let mouse = { inside: false, Tp: null, Hs: null };
  let pins = [];

  function resizeCanvasToCSS() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.floor(rect.width * DPR);
    const h = Math.floor(rect.height * DPR);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  const cssPxToCanvas = px => px * DPR;

  function plotArea() {
    return {
      x0: cssPxToCanvas(M.l),
      y0: cssPxToCanvas(M.t),
      x1: canvas.width - cssPxToCanvas(M.r),
      y1: canvas.height - cssPxToCanvas(M.b)
    };
  }

  function xToPx(x) {
    const a = plotArea();
    return a.x0 + (x - X_MIN) * (a.x1 - a.x0) / (X_MAX - X_MIN);
  }

  function yToPx(y) {
    const a = plotArea();
    return a.y1 - (y - Y_MIN) * (a.y1 - a.y0) / (Y_MAX - Y_MIN);
  }

  function pxToX(px) {
    const a = plotArea();
    return X_MIN + (px - a.x0) * (X_MAX - X_MIN) / (a.x1 - a.x0);
  }

  function pxToY(py) {
    const a = plotArea();
    return Y_MIN + (a.y1 - py) * (Y_MAX - Y_MIN) / (a.y1 - a.y0);
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const roundTo = (v, step) => Math.round(v / step) * step;

  function drawLine(x0, y0, x1, y1, strokeStyle, lineWidth = 1, dash = null) {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  function drawText(text, x, y, align = 'left', baseline = 'alphabetic', fill = 'rgba(0,0,0,0.9)', fontPx = 12) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.font = `${Math.round(fontPx * DPR)}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function H_break(T) {
    if (!Number.isFinite(T) || T <= 0) return 0;
    return (g * T * T) / (14 * Math.PI);
  }

  function Hs_PM_fullyDeveloped(Tp) {
    if (!Number.isFinite(Tp) || Tp <= 0) return 0;
    return 0.21 * g * Tp * Tp / (7.54 * 7.54);
  }

  function verticalSpeedMax(H, T) {
    if (!Number.isFinite(H) || !Number.isFinite(T) || T <= 0) return 0;
    return Math.PI * H / T;
  }

  const mpsToKnots = v => v * 1.9438444924406;
  const mpsToMpm = v => v * 60;

  function speedIsoLineText(v) {
    return `H = (${v.toFixed(2)}/π)·T`;
  }

  function seaStateForHs(Hs) {
    if (Hs === 0) return '0';
    if (Hs > 0 && Hs <= 0.1) return '1';
    if (Hs > 0.1 && Hs <= 0.5) return '2';
    if (Hs > 0.5 && Hs <= 1.25) return '3';
    if (Hs > 1.25 && Hs <= 2.5) return '4';
    if (Hs > 2.5 && Hs <= 4) return '5';
    if (Hs > 4 && Hs <= 6) return '6';
    if (Hs > 6 && Hs <= 9) return '7';
    if (Hs > 9 && Hs <= 14) return '8';
    if (Hs > 14) return '9';
    return '?';
  }

  function drawAxes() {
    const a = plotArea();
    drawLine(a.x0, a.y0, a.x1, a.y0, 'rgba(127,127,127,.55)', 1);
    drawLine(a.x1, a.y0, a.x1, a.y1, 'rgba(127,127,127,.55)', 1);
    drawLine(a.x1, a.y1, a.x0, a.y1, 'rgba(127,127,127,.55)', 1);
    drawLine(a.x0, a.y1, a.x0, a.y0, 'rgba(127,127,127,.55)', 1);

    const xTicks = [2, 4, 6, 8, 10, 12, 14, 16, 18];
    const yTicks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    if (toggleGrid.checked) {
      xTicks.forEach(t => drawLine(xToPx(t), a.y0, xToPx(t), a.y1, 'rgba(127,127,127,.18)', 1));
      yTicks.forEach(t => drawLine(a.x0, yToPx(t), a.x1, yToPx(t), 'rgba(127,127,127,.18)', 1));
    }

    xTicks.forEach(t => {
      const x = xToPx(t);
      drawLine(x, a.y1, x, a.y1 + cssPxToCanvas(6), 'rgba(127,127,127,.55)', 1);
      drawText(String(t), x, a.y1 + cssPxToCanvas(22), 'center', 'alphabetic', 'rgba(50,50,50,.95)', 12);
    });

    yTicks.forEach(t => {
      const y = yToPx(t);
      drawLine(a.x0 - cssPxToCanvas(6), y, a.x0, y, 'rgba(127,127,127,.55)', 1);
      drawText(String(t), a.x0 - cssPxToCanvas(12), y, 'right', 'middle', 'rgba(50,50,50,.95)', 12);
    });

    drawText('Peak Period Tp (s)', (a.x0 + a.x1) / 2, canvas.height - cssPxToCanvas(14), 'center', 'alphabetic', 'rgba(50,50,50,.95)', 13);
    ctx.save();
    ctx.translate(cssPxToCanvas(18), (a.y0 + a.y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(50,50,50,.95)';
    ctx.font = `${Math.round(13 * DPR)}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Significant Wave Height Hs (m)', 0, 0);
    ctx.restore();
  }

  function drawRegions() {
    if (!toggleRegions.checked) return;
    regions.forEach(r => {
      const x0 = xToPx(r.tp[0]);
      const x1 = xToPx(r.tp[1]);
      const y1 = yToPx(r.hs[0]);
      const y0 = yToPx(r.hs[1]);
      ctx.save();
      ctx.fillStyle = r.color;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
      drawText(`SS ${r.ss}`, (x0 + x1) / 2, (y0 + y1) / 2, 'center', 'middle', 'rgba(30,30,30,.85)', 13);
      drawLine(x0, y0, x1, y0, 'rgba(127,127,127,.35)', 1);
      drawLine(x1, y0, x1, y1, 'rgba(127,127,127,.35)', 1);
      drawLine(x1, y1, x0, y1, 'rgba(127,127,127,.35)', 1);
      drawLine(x0, y1, x0, y0, 'rgba(127,127,127,.35)', 1);
    });
  }

  function drawCurve(f, strokeStyle, lineWidth = 2, dash = null) {
    const N = 400;
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= N; i += 1) {
      const T = X_MIN + (X_MAX - X_MIN) * (i / N);
      const H = f(T);
      if (!Number.isFinite(H) || H < Y_MIN || H > Y_MAX) {
        started = false;
        continue;
      }
      const x = xToPx(T);
      const y = yToPx(H);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawOverlays() {
    if (toggleBreaking.checked) {
      drawCurve(H_break, 'rgba(0,0,0,.70)', 2.5, [8, 6]);
      const Tlab = 12;
      const Hlab = H_break(Tlab);
      if (Hlab >= Y_MIN && Hlab <= Y_MAX) {
        drawText('Breaking limit (H/L≈1/7)', xToPx(Tlab) + cssPxToCanvas(6), yToPx(Hlab) - cssPxToCanvas(6), 'left', 'alphabetic', 'rgba(0,0,0,.8)', 12);
      }
    }

    if (togglePM.checked) {
      drawCurve(Hs_PM_fullyDeveloped, 'rgba(0,0,0,.70)', 2.5, null);
      const Tlab = 14;
      const Hlab = Hs_PM_fullyDeveloped(Tlab);
      if (Hlab >= Y_MIN && Hlab <= Y_MAX) {
        drawText('PM fully developed sea', xToPx(Tlab) + cssPxToCanvas(6), yToPx(Hlab) + cssPxToCanvas(14), 'left', 'alphabetic', 'rgba(0,0,0,.8)', 12);
      }
    }
  }

  function drawCrosshairAt(Tp, Hs, style = 'rgba(20,20,20,.65)', dash = [6, 6]) {
    const a = plotArea();
    const x = xToPx(Tp);
    const y = yToPx(Hs);
    drawLine(x, a.y0, x, a.y1, style, 1, dash);
    drawLine(a.x0, y, a.x1, y, style, 1, dash);

    ctx.save();
    ctx.fillStyle = 'rgba(20,20,20,.85)';
    ctx.beginPath();
    ctx.arc(x, y, cssPxToCanvas(3.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPins() {
    pins.forEach(p => {
      drawCrosshairAt(p.Tp, p.Hs, 'rgba(20,20,20,.55)', [4, 6]);
      drawText(p.label, xToPx(p.Tp) + cssPxToCanvas(8), yToPx(p.Hs) - cssPxToCanvas(8), 'left', 'alphabetic', 'rgba(20,20,20,.9)', 12);
    });
  }

  function render() {
    resizeCanvasToCSS();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRegions();
    drawAxes();
    drawOverlays();
    drawPins();
    if (mouse.inside && mouse.Tp != null && mouse.Hs != null) {
      drawCrosshairAt(mouse.Tp, mouse.Hs, 'rgba(0,0,0,.65)', [7, 6]);
    }
  }

  function tooltipHtml(Tp, Hs) {
    const vz = verticalSpeedMax(Hs, Tp);
    const kn = mpsToKnots(vz);
    const mpm = mpsToMpm(vz);
    const ss = seaStateForHs(Hs);
    const Hb = H_break(Tp);
    const Hpm = Hs_PM_fullyDeveloped(Tp);

    return `
      <div><span class="k">Tp</span> <span class="mono">${Tp.toFixed(2)} s</span></div>
      <div><span class="k">Hs</span> <span class="mono">${Hs.toFixed(2)} m</span></div>
      <div><span class="k">Sea state (by Hs only)</span> <span class="mono">${ss}</span></div>
      <div style="margin-top:6px;"><span class="k">Max vertical surface speed (sinusoid; using H = Hs)</span></div>
      <div><span class="k">v<sub>z,max</sub></span> <span class="mono">${vz.toFixed(2)} m/s</span> <span class="k">(${kn.toFixed(2)} kn)</span></div>
      <div><span class="k">Speed iso-line</span> <span class="mono">${speedIsoLineText(vz)}</span></div>
      <div><span class="k">Equivalent speed</span> <span class="mono">${mpm.toFixed(1)} m/min</span></div>
      <div><span class="k">Formula</span> <span class="mono">v<sub>z,max</sub> = π·H/T</span></div>
      <div style="margin-top:6px;"><span class="k">Overlay values at this Tp</span></div>
      <div><span class="k">Breaking limit H<sub>break</sub></span> <span class="mono">${Hb.toFixed(2)} m</span></div>
      <div><span class="k">PM fully developed H<sub>s,PM</sub></span> <span class="mono">${Hpm.toFixed(2)} m</span></div>`;
  }

  function updatePinsTable() {
    pinsBody.innerHTML = '';
    pins.forEach(p => {
      const vz = verticalSpeedMax(p.Hs, p.Tp);
      const isoLine = speedIsoLineText(vz);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.label}</td>
        <td class="mono">${p.Tp.toFixed(2)}</td>
        <td class="mono">${p.Hs.toFixed(2)}</td>
        <td class="mono">${isoLine}</td>
        <td class="mono">${vz.toFixed(2)}</td>
        <td class="mono">${mpsToKnots(vz).toFixed(2)}</td>`;
      pinsBody.appendChild(tr);
    });
  }

  function buildLegend() {
    legend.innerHTML = '';
    const section1 = document.createElement('div');
    section1.style.fontWeight = '650';
    section1.textContent = 'Sea state regions';
    legend.appendChild(section1);
    regions.forEach(r => {
      const row = document.createElement('div');
      row.className = 'legitem';
      row.innerHTML = `<span class="swatch" style="background:${r.color}; border: 1px solid var(--paper-line-strong)"></span><span>SS ${r.ss}: Hs ${r.hs[0]}–${r.hs[1]} m, Tp ${r.tp[0]}–${r.tp[1]} s</span>`;
      legend.appendChild(row);
    });

    const section2 = document.createElement('div');
    section2.style.fontWeight = '650';
    section2.style.marginTop = '8px';
    section2.textContent = 'Overlays';
    legend.appendChild(section2);

    const pm = document.createElement('div');
    pm.className = 'legitem';
    pm.innerHTML = '<span class="swatch gray"></span><span>PM fully developed: <span class="mono">Hs = 0.21·g·Tp²/7.54²</span></span>';
    legend.appendChild(pm);

    const br = document.createElement('div');
    br.className = 'legitem';
    br.innerHTML = '<span class="swatch dashed"></span><span>Breaking limit: <span class="mono">H = g·Tp²/(14π)</span> (H/L≈1/7)</span>';
    legend.appendChild(br);
  }

  function getMousePlotValues(evt) {
    const rect = canvas.getBoundingClientRect();
    const cx = (evt.clientX - rect.left) * DPR;
    const cy = (evt.clientY - rect.top) * DPR;
    const a = plotArea();
    const inside = cx >= a.x0 && cx <= a.x1 && cy >= a.y0 && cy <= a.y1;
    if (!inside) return { inside: false, Tp: null, Hs: null };

    let Tp = clamp(pxToX(cx), X_MIN, X_MAX);
    let Hs = clamp(pxToY(cy), Y_MIN, Y_MAX);
    if (toggleSnap.checked) {
      Tp = roundTo(Tp, 0.1);
      Hs = roundTo(Hs, 0.1);
    }
    return { inside: true, Tp, Hs };
  }

  function showTooltip(evt, Tp, Hs) {
    tooltip.innerHTML = tooltipHtml(Tp, Hs);
    tooltip.style.display = 'block';

    const pad = 14;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let x = evt.clientX + 14;
    let y = evt.clientY + 14;
    if (x + tw + pad > window.innerWidth) x = evt.clientX - tw - 14;
    if (y + th + pad > window.innerHeight) y = evt.clientY - th - 14;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  function findNearestPin(Tp, Hs, tolTp, tolHs) {
    let best = null;
    let bestScore = Infinity;
    pins.forEach(p => {
      const dT = Math.abs(p.Tp - Tp);
      const dH = Math.abs(p.Hs - Hs);
      if (dT <= tolTp && dH <= tolHs) {
        const score = dT / tolTp + dH / tolHs;
        if (score < bestScore) {
          bestScore = score;
          best = p;
        }
      }
    });
    return best;
  }

  function nextLabel() {
    return `P${pins.length + 1}`;
  }

  const makeId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  canvas.addEventListener('mousemove', evt => {
    const m = getMousePlotValues(evt);
    mouse = m;
    if (m.inside) {
      showTooltip(evt, m.Tp, m.Hs);
    } else {
      hideTooltip();
    }
    render();
  });

  canvas.addEventListener('mouseleave', () => {
    mouse = { inside: false, Tp: null, Hs: null };
    hideTooltip();
    render();
  });

  canvas.addEventListener('click', evt => {
    const m = getMousePlotValues(evt);
    if (!m.inside) return;
    pins.push({ id: makeId(), Tp: m.Tp, Hs: m.Hs, label: nextLabel() });
    updatePinsTable();
    render();
  });

  canvas.addEventListener('contextmenu', evt => {
    evt.preventDefault();
    const m = getMousePlotValues(evt);
    if (!m.inside) return;
    const hit = findNearestPin(m.Tp, m.Hs, 0.25, 0.25);
    if (!hit) return;
    pins = pins.filter(p => p.id !== hit.id);
    pins.forEach((p, i) => {
      p.label = `P${i + 1}`;
    });
    updatePinsTable();
    render();
  });

  [toggleRegions, toggleGrid, toggleSnap, toggleBreaking, togglePM].forEach(el => {
    el.addEventListener('change', render);
  });

  clearPinsBtn.addEventListener('click', () => {
    pins = [];
    updatePinsTable();
    render();
  });

  window.addEventListener('resize', render);

  buildLegend();
  updatePinsTable();
  render();
}
