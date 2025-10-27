// ===== utils.mjs — shared constants, unit helpers, math, and SVG helpers =====

// ---- Constants (SI-centric where possible) ----
export const IN_PER_MM = 1 / 25.4;
export const M_PER_IN  = 0.0254;
export const G         = 9.80665;          // m/s^2
export const W_PER_HP  = 745.7;            // W per hp (mechanical)
export const TWO_PI    = 2 * Math.PI;
export const CC_PER_GAL = 3785.411784;     // cc per US gallon
export const PSI_TO_PA  = 6894.757293;     // Pa per psi

export const constants = {
  IN_PER_MM, M_PER_IN, G, W_PER_HP, TWO_PI, CC_PER_GAL, PSI_TO_PA
};

// ---- DOM helpers (kept tiny; only used by main & plot modules) ----
export const q = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
export const read = (id) => parseFloat(q(id).value.replace(',', '.'));

// ---- Numeric helpers ----
export const truncToHalf = (x) => Math.floor(x * 2) / 2;
export const isWhole = (x, eps = 1e-9) => Math.abs(x - Math.round(x)) < eps;

// “nice” tick generator for axes
export function niceTicks(min, max, count = 6) {
  const span = Math.max(1e-12, max - min);
  const step0 = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = niceNorm * mag;
  const tmin = Math.ceil(min / step) * step;
  const tmax = Math.floor(max / step) * step;
  const ticks = [];
  for (let v = tmin; v <= tmax + 1e-12; v += step) ticks.push(+v.toFixed(10));
  return { ticks, step };
}

// ---- Mechanics / units helpers ----

// Tension (kgf) from payload + cable-in-water weight per meter * deployed length
export const tension_kgf = (deployed_m, payload_kg, cable_w_kgpm) =>
  +(payload_kg + cable_w_kgpm * deployed_m).toFixed(1);

// Available line tension from electric motor torque cap (kgf)
// motor_tmax_Nm: per motor; multiplied by gear ratios and motor count → drum torque
export function elec_available_tension_kgf(motor_tmax_Nm, gr1, gr2, motors, radius_m) {
  if (!Number.isFinite(motor_tmax_Nm) || motor_tmax_Nm <= 0 || !Number.isFinite(radius_m) || radius_m <= 0) return 0;
  const drum_T = motor_tmax_Nm * (gr1 || 1) * (gr2 || 1) * (motors || 1); // N·m at drum
  const line_N = drum_T / radius_m;                                       // N
  return +(line_N / G).toFixed(1);                                        // kgf
}

// Line speed (m/min) from motor rpm at given layer diameter & gear reductions
export function line_speed_mpm_from_motor_rpm(motor_rpm, gr1, gr2, layer_dia_in) {
  const drum_rpm = motor_rpm / (Math.max(gr1, 1e-9) * Math.max(gr2, 1e-9));
  const D_m = layer_dia_in * M_PER_IN;
  return Math.PI * D_m * drum_rpm;
}

// Hydraulic conversions & power
export const gpm_from_cc_rev_and_rpm = (cc_rev, rpm) => (cc_rev * rpm) / CC_PER_GAL;
export const rpm_from_gpm_and_disp   = (gpm, cc_rev) => (gpm * CC_PER_GAL) / Math.max(cc_rev, 1e-9);

export function psi_from_torque_and_disp_Nm_cc(torque_Nm, cc_rev) {
  const V = Math.max(cc_rev, 1e-12) * 1e-6;     // m^3/rev
  const dP_Pa = (torque_Nm * TWO_PI) / V;       // Pa
  return dP_Pa / PSI_TO_PA;                     // psi
}

export function torque_per_motor_from_pressure_Pa(dP_Pa, cc_rev) {
  const V = Math.max(cc_rev, 1e-12) * 1e-6;     // m^3/rev
  return (dP_Pa * V) / TWO_PI;                  // N·m per motor
}

export const hp_from_psi_and_gpm = (psi, gpm) => (psi * gpm) / 1714;

// ---- SVG helpers ----
const NS = 'http://www.w3.org/2000/svg';

export function svgEl(name, attrs = {}) {
  const el = document.createElementNS(NS, name);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

export function svgPathFromPoints(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
  return d;
}
