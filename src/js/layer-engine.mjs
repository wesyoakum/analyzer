// ===== layer-engine.mjs — geometry + wrap/layer generation =====
// Pure math: no DOM. Produces per-wrap rows and a summary for downstream modules.

import { IN_PER_MM, M_PER_IN, truncToHalf, isWhole } from './utils.mjs';

/**
 * @typedef {Object} LayerEngineConfig
 * @property {number} cable_dia_mm
 * @property {number} operating_depth_m
 * @property {number} dead_end_m
 * @property {number} core_dia_in
 * @property {number} flange_to_flange_in
 * @property {number} lebus_thk_in
 * @property {number} [packing_factor=0.877]   // radial growth per layer = cable_dia * packing_factor
 * @property {number} [wraps_per_layer_override]          // >0 uses manual wraps per layer, else auto-calculated
 */

/**
 * @typedef {Object} WrapRow
 * @property {number} wrap_no
 * @property {number} layer_no
 * @property {number} layer_dia_in               // in
 * @property {number} wrap_len_in                // in
 * @property {number} pre_spooled_len_m          // m on drum BEFORE this wrap
 * @property {number} spooled_len_m              // m on drum AFTER this wrap
 * @property {number} deployed_len_m             // m deployed after this wrap
 * @property {number} total_cable_len_m          // total cable length (m)
 */

/**
 * @typedef {Object} LayerSummary
 * @property {number} total_layers
 * @property {number} full_drum_dia_in
 * @property {number} total_wraps
 * @property {number} cable_len_m
 */

/**
 * Generate wrap rows for a given drum + cable setup.
 * Returns { rows, summary }.
 * @param {LayerEngineConfig} cfg
 * @returns {{ rows: WrapRow[], summary: LayerSummary }}
 */
export function calcLayers(cfg) {
  const {
    cable_dia_mm,
    operating_depth_m,
    dead_end_m,
    core_dia_in,
    flange_to_flange_in,
    lebus_thk_in,
    packing_factor = 0.877,
    wraps_per_layer_override
  } = cfg;

  const must = [
    cable_dia_mm, operating_depth_m, dead_end_m,
    core_dia_in, flange_to_flange_in, lebus_thk_in
  ];
  if (!must.every(Number.isFinite)) {
    throw new Error('Missing/invalid input to calcLayers().');
  }

  const cable_dia_in = cable_dia_mm * IN_PER_MM; // mm → in
  if (cable_dia_in <= 0) throw new Error('Cable diameter must be > 0.');

  const cable_len_m = operating_depth_m + dead_end_m;

  // Max wraps per layer: width / cable_dia, always truncated to .0/.5 unless overridden
  const raw_wraps = flange_to_flange_in / cable_dia_in;
  const calc_wraps = truncToHalf(raw_wraps);
  const has_override = Number.isFinite(wraps_per_layer_override) && wraps_per_layer_override > 0;
  const max_wraps_per_layer = has_override ? wraps_per_layer_override : calc_wraps;
  if (!Number.isFinite(max_wraps_per_layer) || max_wraps_per_layer <= 0) {
    throw new Error('Wraps per layer must be > 0.');
  }

  // Bare drum diameter includes lebus thickness + one cable diameter (as per prior logic)
  const bare_drum_dia_in = core_dia_in + 2 * lebus_thk_in + cable_dia_in;

  let layer_no = 1;
  let layer_dia_in = bare_drum_dia_in;
  let spooled_len_m = 0;
  let wrap_no = 0;

  /** @type {WrapRow[]} */
  const rows = [];

  // Iterate until all cable length is placed on drum
  while (spooled_len_m + 1e-12 < cable_len_m) {
    let wraps_this_layer = max_wraps_per_layer;

    // If max wraps is an integer, reduce even layers by 1
    if (
      isWhole(max_wraps_per_layer) &&
      (layer_no % 2 === 0)
    ) {
      wraps_this_layer = Math.max(0, max_wraps_per_layer - 1);
    }

    const wrap_len_in = Math.PI * layer_dia_in;
    const wrap_len_m = wrap_len_in * M_PER_IN;

    for (let w = 1; w <= wraps_this_layer; w++) {
      wrap_no++;
      const pre_spooled = spooled_len_m;
      const next_spooled = pre_spooled + wrap_len_m;

      rows.push({
        wrap_no,
        layer_no,
        layer_dia_in: +layer_dia_in.toFixed(3),
        wrap_len_in: +wrap_len_in.toFixed(3),
        pre_spooled_len_m: +Math.min(pre_spooled, cable_len_m).toFixed(3),
        spooled_len_m: +Math.min(next_spooled, cable_len_m).toFixed(3),
        deployed_len_m: +Math.max(cable_len_m - next_spooled, 0).toFixed(3),
        total_cable_len_m: +cable_len_m.toFixed(3)
      });

      spooled_len_m = next_spooled;
      if (spooled_len_m + 1e-12 >= cable_len_m) break; // done
    }

    // Next layer diameter grows by cable_dia_in * packing_factor
    layer_no++;
    layer_dia_in += cable_dia_in * packing_factor;
  }

  const total_layers = rows.length ? rows[rows.length - 1].layer_no : 0;
  const full_drum_dia_in = rows.length ? rows[rows.length - 1].layer_dia_in : bare_drum_dia_in;

  return {
    rows,
    summary: {
      total_layers,
      full_drum_dia_in,
      total_wraps: wrap_no,
      cable_len_m: +cable_len_m.toFixed(3)
    }
  };
}
