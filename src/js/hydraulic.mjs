// ===== hydraulic.mjs — hydraulic-side layer aggregation + table rendering =====

import {
  formatDecimal,
  formatHp,
  formatInches,
  formatInteger,
  formatKgf,
  formatMeters,
  formatPsi,
  formatSpeed
} from './table-formatters.mjs';

/**
 * Convert per-wrap rows into per-layer rows for the Hydraulic table.
 * Values are taken from the FIRST wrap in each layer (start-of-layer).
 * @param {Array<Object>} rows
 * @returns {Array<Object>} sorted by layer_no ascending
 */
export function rowsToHydraulicLayer(rows) {
  const byLayer = new Map();

  // Geometry/depth pre/post
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

        hyd_P_required_psi: null,
        hyd_speed_power_mpm: null,
        hyd_speed_flow_mpm: null,
        hyd_speed_available_mpm: null,
        hyd_hp_req: null,
        hyd_hp_sys: null,
        hyd_tau_avail_Nm: null,
        hyd_tau_avail_kNm: null,
        max_gearbox_torque_Nm: null,
        hyd_tension_theoretical_start_kgf: null,
        hyd_tension_required_start_kgf: null,
        hyd_avail_tension_kgf: null
      });
    } else {
      const L = byLayer.get(r.layer_no);
      L.post_on_drum_m = post_on;
      L.post_deployed_m = post_dep;
    }
  }

  // Fill in start-of-layer hydraulic performance fields
  for (const r of rows) {
    const L = byLayer.get(r.layer_no);
    if (L && L.hyd_P_required_psi === null) {
      L.hyd_P_required_psi = r.hyd_P_required_psi;
      L.hyd_speed_power_mpm = r.hyd_speed_power_mpm;
      L.hyd_speed_flow_mpm = r.hyd_speed_flow_mpm;
      L.hyd_speed_available_mpm = r.hyd_speed_available_mpm;
      L.hyd_hp_req = r.hyd_hp_used_at_available;
      L.hyd_hp_sys = r.hyd_elec_input_hp_used;
      L.hyd_tau_avail_Nm = r.hyd_drum_torque_maxP_Nm ?? null;
      L.hyd_tau_avail_kNm = Number.isFinite(L.hyd_tau_avail_Nm)
        ? +(L.hyd_tau_avail_Nm / 1000).toFixed(1)
        : null;
      L.hyd_tension_theoretical_start_kgf = r.tension_theoretical_kgf ?? null;
      L.hyd_tension_required_start_kgf = r.tension_kgf ?? null;
      L.hyd_avail_tension_kgf = r.hyd_avail_tension_kgf ?? null;
    }
    if (L && Number.isFinite(r.gearbox_torque_Nm)) {
      L.max_gearbox_torque_Nm = Number.isFinite(L.max_gearbox_torque_Nm)
        ? Math.max(L.max_gearbox_torque_Nm, r.gearbox_torque_Nm)
        : r.gearbox_torque_Nm;
    }
  }

  return [...byLayer.values()].sort((a, b) => a.layer_no - b.layer_no);
}

/**
 * Pick the Hydraulic fields needed for the Wraps table (kept small for DOM render).
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
export function projectHydraulicWraps(rows) {
  return rows.map(r => ({
    wrap_no: r.wrap_no,
    layer_no: r.layer_no,
    layer_dia_in: r.layer_dia_in,
    wrap_len_in: r.wrap_len_in,
    pre_spooled_len_m: r.pre_spooled_len_m,
    spooled_len_m: r.spooled_len_m,
    deployed_len_m: r.deployed_len_m,
    total_cable_len_m: r.total_cable_len_m,
    tension_theoretical_kgf: r.tension_theoretical_kgf,
    tension_required_kgf: r.tension_kgf,
    hyd_P_required_psi: r.hyd_P_required_psi,
    hyd_speed_power_mpm: r.hyd_speed_power_mpm,
    hyd_speed_flow_mpm: r.hyd_speed_flow_mpm,
    hyd_speed_available_mpm: r.hyd_speed_available_mpm,
    hyd_hp_req: r.hyd_hp_used_at_available,
    hyd_hp_sys: r.hyd_elec_input_hp_used,
    hyd_tau_avail_kNm: +(r.hyd_drum_torque_maxP_Nm / 1000).toFixed(1),
    gearbox_torque_Nm: r.gearbox_torque_Nm,
    hyd_avail_tension_kgf: r.hyd_avail_tension_kgf,
    hyd_drum_rpm_flow: r.hyd_drum_rpm_flow,
    hyd_drum_rpm_power: r.hyd_drum_rpm_power,
    hyd_drum_rpm_available: r.hyd_drum_rpm_available,
    torque_Nm: r.torque_Nm
  }));
}

/**
 * Render Hydraulic layer + wraps tables (tbody elements provided by caller).
 * @param {Array<Object>} hyLayers
 * @param {Array<Object>} hyWraps
 * @param {HTMLElement} tbodyLayer
 * @param {HTMLElement} tbodyWraps
 */
export function renderHydraulicTables(hyLayers, hyWraps, tbodyLayer, tbodyWraps) {
  // Layer table
  tbodyLayer.innerHTML = '';
  for (const r of hyLayers) {
    const tr = document.createElement('tr');
    const cells = [
      formatInteger(r.layer_no),
      formatInches(r.layer_dia_in),
      formatMeters(r.pre_on_drum_m),
      formatMeters(r.pre_deployed_m),
      formatMeters(r.post_on_drum_m),
      formatMeters(r.post_deployed_m),
      formatPsi(r.hyd_P_required_psi ?? ''),
      formatSpeed(r.hyd_speed_power_mpm ?? ''),
      formatSpeed(r.hyd_speed_flow_mpm ?? ''),
      formatSpeed(r.hyd_speed_available_mpm ?? ''),
      formatHp(r.hyd_hp_req ?? ''),
      formatHp(r.hyd_hp_sys ?? ''),
      formatDecimal(r.hyd_tau_avail_kNm, 1),
      formatDecimal(r.max_gearbox_torque_Nm, 1),
      formatKgf(r.hyd_tension_theoretical_start_kgf),
      formatKgf(r.hyd_tension_required_start_kgf),
      formatKgf(r.hyd_avail_tension_kgf)
    ];
    tr.innerHTML = cells.map(v => `<td>${v}</td>`).join('');
    tbodyLayer.appendChild(tr);
  }

  // Wraps table
  tbodyWraps.innerHTML = '';
  for (const r of hyWraps) {
    const tr = document.createElement('tr');
    const cells = [
      formatInteger(r.wrap_no),
      formatInteger(r.layer_no),
      formatInches(r.layer_dia_in),
      formatInches(r.wrap_len_in),
      formatMeters(r.pre_spooled_len_m),
      formatMeters(r.spooled_len_m),
      formatMeters(r.deployed_len_m),
      formatKgf(r.tension_theoretical_kgf ?? ''),
      formatKgf(r.tension_required_kgf ?? ''),
      formatPsi(r.hyd_P_required_psi),
      formatSpeed(r.hyd_speed_power_mpm),
      formatSpeed(r.hyd_speed_flow_mpm),
      formatSpeed(r.hyd_speed_available_mpm),
      formatHp(r.hyd_hp_req),
      formatHp(r.hyd_hp_sys),
      formatDecimal(r.hyd_tau_avail_kNm, 1),
      formatDecimal(r.gearbox_torque_Nm, 1),
      formatKgf(r.hyd_avail_tension_kgf)
    ];
    tr.innerHTML = cells.map(v => `<td>${v}</td>`).join('');
    tbodyWraps.appendChild(tr);
  }
}
