import {
  G, W_PER_HP, PSI_TO_PA, CC_PER_GAL, M_PER_IN,
  tension_kgf, elec_available_tension_kgf,
  gpm_from_cc_rev_and_rpm, rpm_from_gpm_and_disp,
  psi_from_torque_and_disp_Nm_cc, torque_per_motor_from_pressure_Pa,
  line_speed_mpm_from_motor_rpm, hp_from_psi_and_gpm,
} from './utils.mjs';
import { calcLayers } from './layer-engine.mjs';
import { rowsToElectricLayer, projectElectricWraps } from './electric.mjs';
import { rowsToHydraulicLayer, projectHydraulicWraps } from './hydraulic.mjs';

const positiveOr = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);

export function buildComputationModel(inputs) {
  const cfg = {
    cable_dia_mm: inputs.cable_dia_mm,
    operating_depth_m: inputs.operating_depth_m,
    dead_end_m: inputs.dead_end_m,
    core_dia_in: inputs.core_dia_in,
    flange_dia_in: inputs.flange_dia_in,
    flange_to_flange_in: inputs.flange_to_flange_in,
    lebus_thk_in: inputs.lebus_thk_in,
    packing_factor: inputs.packing_factor,
    wraps_per_layer_override: inputs.wraps_per_layer_override
  };

  const gr1 = positiveOr(inputs.gr1, 1);
  const gr2 = positiveOr(inputs.gr2, 1);
  const motors = positiveOr(inputs.motors, 1);
  const denom_mech = gr1 * gr2 * motors;
  const gear_product = Math.max(gr1, 1e-9) * Math.max(gr2, 1e-9);

  const electricEnabled = Boolean(inputs.electricEnabled);
  const hydraulicEnabled = Boolean(inputs.hydraulicEnabled);

  const motor_max_rpm = inputs.motor_max_rpm;
  const motor_hp = positiveOr(inputs.motor_hp, 0);
  const motor_eff = positiveOr(inputs.motor_eff, 1);
  const motor_tmax = inputs.motor_tmax;
  const gearbox_max_torque_Nm = inputs.gearbox_max_torque_Nm;
  const P_per_motor_W = motor_hp * motor_eff * W_PER_HP;

  const h_strings = positiveOr(inputs.h_strings, 0);
  const h_emotor_hp = positiveOr(inputs.h_emotor_hp, 0);
  const h_emotor_eff = positiveOr(inputs.h_emotor_eff, 0);
  const h_emotor_rpm = positiveOr(inputs.h_emotor_rpm, 0);
  const h_pump_cc = positiveOr(inputs.h_pump_cc, 0);
  const h_max_psi = positiveOr(inputs.h_max_psi, 0);
  const h_hmot_cc = positiveOr(inputs.h_hmot_cc, 0);
  const h_hmot_rpm_cap = positiveOr(inputs.h_hmot_rpm_cap, Infinity);

  const hp_str_usable = h_emotor_hp * h_emotor_eff;
  const hp_tot_usable = hp_str_usable * h_strings;
  const q_str_gpm = gpm_from_cc_rev_and_rpm(h_pump_cc, h_emotor_rpm);
  const q_tot_gpm = q_str_gpm * h_strings;
  const rpm_flow_per_motor_available = Math.min(
    Number.isFinite(h_hmot_rpm_cap) && h_hmot_rpm_cap > 0 ? h_hmot_rpm_cap : Number.POSITIVE_INFINITY,
    rpm_from_gpm_and_disp(q_tot_gpm / Math.max(motors, 1), h_hmot_cc)
  );

  const dP_Pa = h_max_psi * PSI_TO_PA;
  const torque_per_hmotor_maxP = torque_per_motor_from_pressure_Pa(dP_Pa, h_hmot_cc);
  const torque_at_drum_maxP_factor = Math.max(gr1, 1) * Math.max(gr2, 1) * Math.max(motors, 1);

  const { rows: baseRows, summary, meta } = calcLayers(cfg);
  const rows = baseRows.map(r => ({ ...r }));

  for (const r of rows) {
    const theoretical_tension = tension_kgf(r.deployed_len_m, inputs.payload_kg, inputs.cable_w_kgpm);
    const required_tension = +(theoretical_tension).toFixed(1);
    r.tension_theoretical_kgf = theoretical_tension;
    r.tension_kgf = required_tension;
    const tension_N = required_tension * G;
    const radius_m = (r.layer_dia_in * M_PER_IN) / 2;
    const drum_T = tension_N * radius_m;
    const motors_safe = Math.max(motors, 1);
    const gear_product_safe = Math.max(gear_product, 1e-9);
    const torque_per_hmotor_required = drum_T / (gear_product_safe * motors_safe);
    const drum_torque_required = torque_per_hmotor_required * gear_product_safe * motors_safe;
    r.torque_Nm = +drum_torque_required.toFixed(1);
    r.gearbox_torque_Nm = r.torque_Nm;

    if (electricEnabled) {
      const motorTorque_e = r.torque_Nm / (denom_mech || 1);
      r.motor_torque_Nm = +motorTorque_e.toFixed(2);
      let rpm_power_e = 0;
      if (P_per_motor_W > 0 && motorTorque_e > 0) rpm_power_e = (P_per_motor_W / motorTorque_e) * 60 / (2 * Math.PI);
      else if (P_per_motor_W > 0 && motorTorque_e === 0) rpm_power_e = Number.POSITIVE_INFINITY;
      const rpm_gearbox_e = Number.isFinite(motor_max_rpm) ? Math.max(0, motor_max_rpm) : Infinity;
      const rpm_capped_e = Math.min(rpm_gearbox_e, rpm_power_e);
      r.motor_rpm = +((Number.isFinite(rpm_capped_e) ? rpm_capped_e : 0)).toFixed(1);

      const speed_power_e = Number.isFinite(rpm_power_e)
        ? line_speed_mpm_from_motor_rpm(Math.max(0, rpm_power_e), gr1, gr2, r.layer_dia_in)
        : 0;
      const speed_gearbox_e = Number.isFinite(rpm_gearbox_e)
        ? line_speed_mpm_from_motor_rpm(rpm_gearbox_e, gr1, gr2, r.layer_dia_in)
        : Infinity;
      let speed_available_e = Math.min(speed_power_e, speed_gearbox_e);
      if (!Number.isFinite(speed_available_e) || speed_available_e < 0) speed_available_e = 0;

      r.el_speed_power_mpm = +Math.max(0, speed_power_e).toFixed(2);
      r.el_speed_gearbox_mpm = +(Number.isFinite(speed_gearbox_e) ? Math.max(0, speed_gearbox_e) : 0).toFixed(2);
      r.el_speed_available_mpm = +speed_available_e.toFixed(2);
      r.line_speed_mpm = r.el_speed_available_mpm;
      r.avail_tension_kgf = elec_available_tension_kgf(motor_tmax, gr1, gr2, motors, radius_m);
    } else {
      r.motor_torque_Nm = 0; r.motor_rpm = 0; r.line_speed_mpm = 0; r.avail_tension_kgf = 0;
      r.el_speed_power_mpm = 0; r.el_speed_gearbox_mpm = 0; r.el_speed_available_mpm = 0;
    }

    if (hydraulicEnabled) {
      const drum_T_pressure_max = torque_per_hmotor_maxP * torque_at_drum_maxP_factor;
      r.hyd_drum_torque_maxP_Nm = +drum_T_pressure_max.toFixed(2);
      const hyd_avail_tension_N = drum_T_pressure_max / Math.max(radius_m, 1e-12);
      r.hyd_avail_tension_kgf = +(hyd_avail_tension_N / G).toFixed(1);
      const D_m = r.layer_dia_in * M_PER_IN;
      const safe_drum_circumference = Math.max(Math.PI * Math.max(D_m, 1e-9), 1e-9);
      let P_req_psi = psi_from_torque_and_disp_Nm_cc(torque_per_hmotor_required, h_hmot_cc);
      if (!Number.isFinite(P_req_psi) || P_req_psi < 0) P_req_psi = 0;
      const rpm_flow_per_motor = Math.min(h_hmot_rpm_cap, rpm_from_gpm_and_disp(q_tot_gpm / Math.max(motors, 1), h_hmot_cc));
      const speed_flow_mpm = line_speed_mpm_from_motor_rpm(rpm_flow_per_motor, gr1, gr2, r.layer_dia_in);
      const rpm_flow_clean = Number.isFinite(rpm_flow_per_motor) && rpm_flow_per_motor > 0 ? rpm_flow_per_motor : 0;
      const rpm_flow_drum = rpm_flow_clean / gear_product_safe;
      const P_power_psi = (P_req_psi > 0) ? Math.min(P_req_psi, h_max_psi) : 0;
      const hp_elec_in_total = h_emotor_hp * h_strings;
      const eff_total = h_emotor_eff;
      let speed_power_mpm = 0;
      if (hp_elec_in_total > 0 && eff_total > 0 && theoretical_tension > 0) {
        const tension_theoretical_N = theoretical_tension * G;
        if (tension_theoretical_N > 0) speed_power_mpm = ((hp_elec_in_total * eff_total * W_PER_HP) / tension_theoretical_N) * 60;
      }
      if (!Number.isFinite(speed_power_mpm) || speed_power_mpm < 0) speed_power_mpm = 0;
      const rpm_power_drum = Number.isFinite(speed_power_mpm) && speed_power_mpm > 0 ? speed_power_mpm / safe_drum_circumference : 0;
      let speed_avail_mpm = Math.min(speed_power_mpm, speed_flow_mpm);
      if (!Number.isFinite(speed_avail_mpm) || speed_avail_mpm < 0) speed_avail_mpm = 0;
      const rpm_available_drum = Number.isFinite(speed_avail_mpm) ? speed_avail_mpm / safe_drum_circumference : 0;
      let hp_used_at_available = 0;
      if (speed_avail_mpm > 0 && P_power_psi > 0) {
        const drum_rpm_needed = speed_avail_mpm / Math.max(Math.PI * Math.max(D_m, 1e-9), 1e-9);
        const motor_rpm_needed = drum_rpm_needed * (Math.max(gr1, 1) * Math.max(gr2, 1));
        const gpm_per_motor_needed = (motor_rpm_needed * h_hmot_cc) / CC_PER_GAL;
        const gpm_used = Math.min(Math.max(motors, 1) * gpm_per_motor_needed, q_tot_gpm);
        hp_used_at_available = Math.min(hp_from_psi_and_gpm(P_power_psi, gpm_used), hp_tot_usable);
      }
      r.hyd_P_required_psi = Math.round(P_req_psi);
      r.hyd_speed_power_mpm = +speed_power_mpm.toFixed(2);
      r.hyd_speed_flow_mpm = +speed_flow_mpm.toFixed(2);
      r.hyd_speed_available_mpm = +speed_avail_mpm.toFixed(2);
      r.hyd_hp_used_at_available = +hp_used_at_available.toFixed(2);
      r.hyd_elec_input_hp_used = +((h_emotor_eff > 0 ? r.hyd_hp_used_at_available / h_emotor_eff : 0)).toFixed(2);
      r.hyd_drum_rpm_flow = +Math.max(0, rpm_flow_drum).toFixed(1);
      r.hyd_drum_rpm_power = +Math.max(0, rpm_power_drum).toFixed(1);
      r.hyd_drum_rpm_available = +Math.max(0, rpm_available_drum).toFixed(1);
    } else {
      r.hyd_drum_torque_maxP_Nm = 0; r.hyd_avail_tension_kgf = 0; r.hyd_P_required_psi = 0;
      r.hyd_speed_power_mpm = 0; r.hyd_speed_flow_mpm = 0; r.hyd_speed_available_mpm = 0;
      r.hyd_hp_used_at_available = 0; r.hyd_elec_input_hp_used = 0;
      r.hyd_drum_rpm_flow = 0; r.hyd_drum_rpm_power = 0; r.hyd_drum_rpm_available = 0;
    }
  }

  const elLayer = electricEnabled ? rowsToElectricLayer(rows, inputs.payload_kg, inputs.cable_w_kgpm, gr1, gr2, motors) : [];
  const hyLayer = hydraulicEnabled ? rowsToHydraulicLayer(rows, inputs.payload_kg, inputs.cable_w_kgpm) : [];
  const elWraps = electricEnabled ? projectElectricWraps(rows) : [];
  const hyWraps = hydraulicEnabled ? projectHydraulicWraps(rows) : [];

  return {
    cfg, summary, meta, rows,
    electricEnabled, hydraulicEnabled,
    inputs: { ...inputs, gr1, gr2, motors, denom_mech, gear_product, gearbox_max_torque_Nm, P_per_motor_W },
    hydraulic: { h_strings, h_emotor_hp, h_emotor_eff, h_emotor_rpm, h_pump_cc, h_max_psi, h_hmot_cc, h_hmot_rpm_cap, torque_per_hmotor_maxP, torque_at_drum_maxP_factor, q_tot_gpm, rpm_flow_per_motor_available },
    tables: { elLayer, hyLayer, elWraps, hyWraps }
  };
}
