// ===== electric.mjs — electric-side layer aggregation + table rendering =====
import {
  G, M_PER_IN,
  tension_kgf, elec_available_tension_kgf,
  TENSION_SAFETY_FACTOR
} from './utils.mjs';

/**
 * Convert per-wrap rows into per-layer rows for the Electric table.
 * - Pre/post values: taken from first/last wrap of each layer.
 * - Start-of-layer motor rpm, line speed, and available tension: taken from the FIRST wrap of each layer.
 * - Max tension/torque fields computed at the layer start (pre-wrap).
 *
 * @param {Array<Object>} rows
 * @param {number} payload_kg
 * @param {number} cable_w_kgpm
 * @param {number} gr1
 * @param {number} gr2
 * @param {number} motors
 * @returns {Array<Object>} sorted by layer_no ascending
 */
export function rowsToElectricLayer(rows, payload_kg, cable_w_kgpm, gr1, gr2, motors) {
  const byLayer = new Map();

  // First pass: collect pre/post geometry/depth
  for (const r of rows) {
    const total = r.total_cable_len_m;
    const pre_on = r.pre_spooled_len_m;
    const pre_dep = +(total - pre_on).toFixed(3);
    const post_on = r.spooled_len_m;
    const post_dep = +(total - post_on).toFixed(3);

    if (!byLayer.has(r.layer_no)) {
      byLayer.set(r.layer_no, {
        layer_no: r.layer_no,
        layer_dia_in: r.layer_dia_in,
        pre_on_drum_m: pre_on,
        pre_deployed_m: pre_dep,
        post_on_drum_m: post_on,
        post_deployed_m: post_dep,
        motor_rpm_at_start: null,
        line_speed_at_start_mpm: null,
        avail_tension_kgf_at_start: null
      });
    } else {
      const L = byLayer.get(r.layer_no);
      L.post_on_drum_m = post_on;
      L.post_deployed_m = post_dep;
    }
  }

  // Second pass: stash start-of-layer dynamic values from the first wrap in that layer
  for (const r of rows) {
    const L = byLayer.get(r.layer_no);
    if (L && L.motor_rpm_at_start === null) {
      L.motor_rpm_at_start = r.motor_rpm ?? '';
      L.line_speed_at_start_mpm = r.line_speed_mpm ?? '';
      L.avail_tension_kgf_at_start = r.avail_tension_kgf ?? '';
    }
  }

  // Final: compute max tension/torque values at the layer start (pre-wrap)
  const out = [];
  const denom = (gr1 || 1) * (gr2 || 1) * (motors || 1);

  for (const L of [...byLayer.values()].sort((a, b) => a.layer_no - b.layer_no)) {
    const maxTheo_kgf = tension_kgf(L.pre_deployed_m, payload_kg, cable_w_kgpm);
    const maxReq_kgf = +(maxTheo_kgf * TENSION_SAFETY_FACTOR).toFixed(1);
    const radius_m = (L.layer_dia_in * M_PER_IN) / 2;
    const maxT_Nm = +(maxReq_kgf * G * radius_m).toFixed(1);
    const maxMotorNm = +(maxT_Nm / denom).toFixed(1);

    out.push({
      ...L,
      max_tension_theoretical_kgf: maxTheo_kgf,
      max_tension_required_kgf: maxReq_kgf,
      max_torque_Nm: maxT_Nm,
      max_motor_torque_Nm: maxMotorNm
    });
  }
  return out;
}

/**
 * Pick the Electric fields needed for the Wraps table (kept small for DOM render).
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
export function projectElectricWraps(rows) {
  return rows.map(r => ({
    wrap_no: r.wrap_no,
    layer_no: r.layer_no,
    layer_dia_in: r.layer_dia_in,
    wrap_len_in: r.wrap_len_in,
    pre_spooled_len_m: r.pre_spooled_len_m,
    spooled_len_m: r.spooled_len_m,
    deployed_len_m: r.deployed_len_m,
    total_cable_len_m: r.total_cable_len_m,
    tension_required_kgf: r.tension_kgf,
    tension_theoretical_kgf: r.tension_theoretical_kgf,
    torque_Nm: r.torque_Nm,
    motor_torque_Nm: r.motor_torque_Nm,
    motor_rpm: r.motor_rpm,
    line_speed_mpm: r.line_speed_mpm,
    avail_tension_kgf: r.avail_tension_kgf
  }));
}

/**
 * Render Electric layer + wraps tables (tbody elements provided by caller).
 * @param {Array<Object>} elLayers
 * @param {Array<Object>} elWraps
 * @param {HTMLElement} tbodyLayer
 * @param {HTMLElement} tbodyWraps
 */
export function renderElectricTables(elLayers, elWraps, tbodyLayer, tbodyWraps) {
  // Layer table
  tbodyLayer.innerHTML = '';
  for (const r of elLayers) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.layer_no}</td><td>${r.layer_dia_in}</td>
      <td>${r.pre_on_drum_m}</td><td>${r.pre_deployed_m}</td>
      <td>${r.post_on_drum_m}</td><td>${r.post_deployed_m}</td>
      <td>${r.max_tension_theoretical_kgf}</td><td>${r.max_tension_required_kgf}</td>
      <td>${r.max_torque_Nm}</td><td>${r.max_motor_torque_Nm}</td>
      <td>${r.motor_rpm_at_start ?? ''}</td><td>${r.line_speed_at_start_mpm ?? ''}</td><td>${r.avail_tension_kgf_at_start ?? ''}</td>`;
    tbodyLayer.appendChild(tr);
  }

  // Wraps table
  tbodyWraps.innerHTML = '';
  for (const r of elWraps) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.wrap_no}</td><td>${r.layer_no}</td><td>${r.layer_dia_in}</td>
      <td>${r.wrap_len_in}</td><td>${r.pre_spooled_len_m}</td><td>${r.spooled_len_m}</td><td>${r.deployed_len_m}</td>
      <td>${r.tension_theoretical_kgf ?? ''}</td><td>${r.tension_required_kgf ?? ''}</td>
      <td>${r.torque_Nm}</td><td>${r.motor_torque_Nm}</td>
      <td>${r.motor_rpm}</td><td>${r.line_speed_mpm}</td><td>${r.avail_tension_kgf}</td>`;
    tbodyWraps.appendChild(tr);
  }
}
