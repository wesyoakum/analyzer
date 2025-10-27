// ===== hydraulic.mjs — hydraulic-side layer aggregation + table rendering =====

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
        hyd_hp_used_at_available: null,
        hyd_elec_input_hp_used: null,
        hyd_drum_torque_at_maxP_Nm: null,
        hyd_avail_tension_kgf_at_start: null
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
      L.hyd_hp_used_at_available = r.hyd_hp_used_at_available;
      L.hyd_elec_input_hp_used = r.hyd_elec_input_hp_used;
      L.hyd_drum_torque_at_maxP_Nm = r.hyd_drum_torque_maxP_Nm ?? null;
      L.hyd_avail_tension_kgf_at_start = r.hyd_avail_tension_kgf ?? null;
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
    hyd_P_required_psi: r.hyd_P_required_psi,
    hyd_speed_power_mpm: r.hyd_speed_power_mpm,
    hyd_speed_flow_mpm: r.hyd_speed_flow_mpm,
    hyd_speed_available_mpm: r.hyd_speed_available_mpm,
    hyd_hp_used_at_available: r.hyd_hp_used_at_available,
    hyd_elec_input_hp_used: r.hyd_elec_input_hp_used,
    hyd_drum_torque_maxP_Nm: r.hyd_drum_torque_maxP_Nm,
    hyd_avail_tension_kgf: r.hyd_avail_tension_kgf
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
    tr.innerHTML = `
      <td>${r.layer_no}</td><td>${r.layer_dia_in}</td>
      <td>${r.pre_on_drum_m}</td><td>${r.pre_deployed_m}</td>
      <td>${r.post_on_drum_m}</td><td>${r.post_deployed_m}</td>
      <td>${r.hyd_P_required_psi ?? ''}</td><td>${r.hyd_speed_power_mpm ?? ''}</td>
      <td>${r.hyd_speed_flow_mpm ?? ''}</td><td>${r.hyd_speed_available_mpm ?? ''}</td>
      <td>${r.hyd_hp_used_at_available ?? ''}</td><td>${r.hyd_elec_input_hp_used ?? ''}</td>
      <td>${r.hyd_drum_torque_at_maxP_Nm ?? ''}</td><td>${r.hyd_avail_tension_kgf_at_start ?? ''}</td>`;
    tbodyLayer.appendChild(tr);
  }

  // Wraps table
  tbodyWraps.innerHTML = '';
  for (const r of hyWraps) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.wrap_no}</td><td>${r.layer_no}</td><td>${r.layer_dia_in}</td>
      <td>${r.wrap_len_in}</td><td>${r.pre_spooled_len_m}</td><td>${r.spooled_len_m}</td><td>${r.deployed_len_m}</td>
      <td>${r.hyd_P_required_psi}</td><td>${r.hyd_speed_power_mpm}</td>
      <td>${r.hyd_speed_flow_mpm}</td><td>${r.hyd_speed_available_mpm}</td>
      <td>${r.hyd_hp_used_at_available}</td><td>${r.hyd_elec_input_hp_used}</td>
      <td>${r.hyd_drum_torque_maxP_Nm}</td><td>${r.hyd_avail_tension_kgf}</td>`;
    tbodyWraps.appendChild(tr);
  }
}
