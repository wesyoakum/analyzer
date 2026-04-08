// ===== mathcad-sheet.mjs — Mathcad-style calculation sheet renderer =====
// Renders all analysis calculations as formatted KaTeX equations.
// Supports two modes: symbolic (general form) and numeric (substituted values).

import { G, W_PER_HP, PSI_TO_PA, CC_PER_GAL, M_PER_IN } from './utils.mjs';

// ---- Helpers ----
const fmt = (v, dp = 2) => {
  if (!Number.isFinite(v)) return '\\text{--}';
  // Use thin-space thousand separator for readability
  const s = v.toFixed(dp);
  const [int, dec] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');
  return dec ? `${grouped}.${dec}` : grouped;
};

const fmtInt = (v) => fmt(v, 0);
const fmt1 = (v) => fmt(v, 1);
const fmt2 = (v) => fmt(v, 2);
const fmt3 = (v) => fmt(v, 3);
const fmt4 = (v) => fmt(v, 4);

/**
 * Build a single Mathcad line: assignment or result.
 * @param {'assign'|'result'|'note'|'heading'|'subheading'} type
 * @param {string} latex
 * @returns {string} HTML
 */
function mcLine(type, latex) {
  if (type === 'heading') return `<h3 class="mcad-heading">${latex}</h3>`;
  if (type === 'subheading') return `<h4 class="mcad-subheading">${latex}</h4>`;
  if (type === 'note') return `<p class="mcad-note">${latex}</p>`;
  const cls = type === 'result' ? 'mcad-line mcad-line--result' : 'mcad-line';
  return `<div class="${cls}"><span class="math" data-latex="${escAttr(latex)}" data-display="block"></span></div>`;
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render the full Mathcad-style sheet.
 * @param {HTMLElement} container
 * @param {object} model - output of buildComputationModel()
 * @param {'symbolic'|'numeric'} mode
 */
export function renderMathcadSheet(container, model, mode = 'symbolic') {
  if (!container) return;
  if (!model || !model.rows || !model.rows.length) {
    container.innerHTML = '<p class="mcad-empty">Run analysis to see calculations.</p>';
    return;
  }

  const sym = mode === 'symbolic';
  const lines = [];

  const inp = model.inputs;
  const summ = model.summary;
  const meta = model.meta;
  const hy = model.hydraulic;
  const rows = model.rows;

  // Pick representative rows: first wrap (bare drum), last wrap (full drum)
  const r0 = rows[0];
  const rN = rows[rows.length - 1];

  // Intermediate values
  const cable_dia_in = inp.cable_dia_mm * (1 / 25.4);
  const cable_len_m = (inp.operating_depth_m || 0) + (inp.dead_end_m || 0);
  const bare_drum_dia_in = (inp.core_dia_in || 0) + 2 * (inp.lebus_thk_in || 0) + cable_dia_in;
  const gr1 = inp.gr1 || 1;
  const gr2 = inp.gr2 || 1;
  const motors = inp.motors || 1;

  // =====================================================
  // SECTION A: INPUT PARAMETERS
  // =====================================================
  lines.push(mcLine('heading', 'A) Input Parameters'));

  lines.push(mcLine('subheading', 'Cable &amp; Drum'));
  if (sym) {
    lines.push(mcLine('assign', 'd_c := \\text{cable diameter}'));
    lines.push(mcLine('assign', 'z_{\\mathrm{op}} := \\text{operating depth}'));
    lines.push(mcLine('assign', 'z_{\\mathrm{dead}} := \\text{dead end reserve}'));
    lines.push(mcLine('assign', 'D_{\\mathrm{core}} := \\text{drum core diameter}'));
    lines.push(mcLine('assign', 'F_{f2f} := \\text{flange-to-flange width}'));
    lines.push(mcLine('assign', 't_{\\mathrm{lebus}} := \\text{Lebus strip thickness}'));
    lines.push(mcLine('assign', '\\phi := \\text{packing factor}'));
    lines.push(mcLine('assign', 'm_{\\mathrm{payload}} := \\text{payload weight in water}'));
    lines.push(mcLine('assign', 'w_c := \\text{cable weight in water}'));
  } else {
    lines.push(mcLine('assign', `d_c := ${fmt2(inp.cable_dia_mm)} \\; \\mathrm{mm}`));
    lines.push(mcLine('assign', `z_{\\mathrm{op}} := ${fmt1(inp.operating_depth_m)} \\; \\mathrm{m}`));
    lines.push(mcLine('assign', `z_{\\mathrm{dead}} := ${fmt1(inp.dead_end_m)} \\; \\mathrm{m}`));
    lines.push(mcLine('assign', `D_{\\mathrm{core}} := ${fmt3(inp.core_dia_in)} \\; \\mathrm{in}`));
    lines.push(mcLine('assign', `F_{f2f} := ${fmt3(inp.flange_to_flange_in)} \\; \\mathrm{in}`));
    lines.push(mcLine('assign', `t_{\\mathrm{lebus}} := ${fmt3(inp.lebus_thk_in)} \\; \\mathrm{in}`));
    lines.push(mcLine('assign', `\\phi := ${fmt3(inp.packing_factor)}`));
    lines.push(mcLine('assign', `m_{\\mathrm{payload}} := ${fmt1(inp.payload_kg)} \\; \\mathrm{kgf}`));
    lines.push(mcLine('assign', `w_c := ${fmt3(inp.cable_w_kgpm)} \\; \\mathrm{kgf/m}`));
  }

  lines.push(mcLine('subheading', 'Drive Parameters'));
  if (sym) {
    lines.push(mcLine('assign', 'G_1 := \\text{gear ratio 1 (gearbox)}'));
    lines.push(mcLine('assign', 'G_2 := \\text{gear ratio 2 (ring gear)}'));
    lines.push(mcLine('assign', 'N_m := \\text{number of motors}'));
  } else {
    lines.push(mcLine('assign', `G_1 := ${fmt3(gr1)}`));
    lines.push(mcLine('assign', `G_2 := ${fmt3(gr2)}`));
    lines.push(mcLine('assign', `N_m := ${fmtInt(motors)}`));
  }

  if (model.electricEnabled) {
    lines.push(mcLine('subheading', 'Electric Motor'));
    if (sym) {
      lines.push(mcLine('assign', '\\mathrm{HP}_{\\mathrm{motor}} := \\text{rated motor horsepower}'));
      lines.push(mcLine('assign', '\\eta_{\\mathrm{motor}} := \\text{motor efficiency}'));
      lines.push(mcLine('assign', '\\omega_{\\max} := \\text{motor max RPM}'));
      lines.push(mcLine('assign', '\\tau_{\\mathrm{motor,max}} := \\text{motor peak torque}'));
    } else {
      lines.push(mcLine('assign', `\\mathrm{HP}_{\\mathrm{motor}} := ${fmt1(inp.motor_hp)} \\; \\mathrm{hp}`));
      lines.push(mcLine('assign', `\\eta_{\\mathrm{motor}} := ${fmt3(inp.motor_eff)}`));
      lines.push(mcLine('assign', `\\omega_{\\max} := ${fmt1(inp.motor_max_rpm)} \\; \\mathrm{rpm}`));
      lines.push(mcLine('assign', `\\tau_{\\mathrm{motor,max}} := ${fmt1(inp.motor_tmax)} \\; \\mathrm{N{\\cdot}m}`));
    }
  }

  if (model.hydraulicEnabled) {
    lines.push(mcLine('subheading', 'Hydraulic System'));
    if (sym) {
      lines.push(mcLine('assign', 'N_{\\mathrm{strings}} := \\text{number of pump strings}'));
      lines.push(mcLine('assign', '\\mathrm{HP}_e := \\text{electric motor HP per string}'));
      lines.push(mcLine('assign', '\\eta_e := \\text{electric motor efficiency}'));
      lines.push(mcLine('assign', '\\omega_e := \\text{electric motor RPM}'));
      lines.push(mcLine('assign', '\\delta_p := \\text{pump displacement}'));
      lines.push(mcLine('assign', 'P_{\\max} := \\text{system max pressure}'));
      lines.push(mcLine('assign', '\\delta_m := \\text{hydraulic motor displacement}'));
    } else {
      lines.push(mcLine('assign', `N_{\\mathrm{strings}} := ${fmtInt(hy.h_strings)}`));
      lines.push(mcLine('assign', `\\mathrm{HP}_e := ${fmt1(hy.h_emotor_hp)} \\; \\mathrm{hp}`));
      lines.push(mcLine('assign', `\\eta_e := ${fmt3(hy.h_emotor_eff)}`));
      lines.push(mcLine('assign', `\\omega_e := ${fmt1(hy.h_emotor_rpm)} \\; \\mathrm{rpm}`));
      lines.push(mcLine('assign', `\\delta_p := ${fmt1(hy.h_pump_cc)} \\; \\mathrm{cc/rev}`));
      lines.push(mcLine('assign', `P_{\\max} := ${fmtInt(hy.h_max_psi)} \\; \\mathrm{psi}`));
      lines.push(mcLine('assign', `\\delta_m := ${fmt1(hy.h_hmot_cc)} \\; \\mathrm{cc/rev}`));
    }
  }

  // =====================================================
  // SECTION B: DRUM GEOMETRY
  // =====================================================
  lines.push(mcLine('heading', 'B) Drum Geometry'));

  lines.push(mcLine('subheading', 'Total cable length'));
  if (sym) {
    lines.push(mcLine('assign', 'L_{\\mathrm{cable}} := z_{\\mathrm{op}} + z_{\\mathrm{dead}}'));
  } else {
    lines.push(mcLine('assign', `L_{\\mathrm{cable}} := ${fmt1(inp.operating_depth_m)} + ${fmt1(inp.dead_end_m)}`));
    lines.push(mcLine('result', `L_{\\mathrm{cable}} = ${fmt1(cable_len_m)} \\; \\mathrm{m}`));
  }

  lines.push(mcLine('subheading', 'Wraps per layer'));
  if (sym) {
    lines.push(mcLine('assign', 'W_{\\mathrm{layer}} := \\mathrm{trunc}_{0.5}\\!\\left(\\frac{F_{f2f}}{d_c}\\right)'));
  } else {
    const raw_wraps = inp.flange_to_flange_in / cable_dia_in;
    lines.push(mcLine('assign', `W_{\\mathrm{layer}} := \\mathrm{trunc}_{0.5}\\!\\left(\\frac{${fmt3(inp.flange_to_flange_in)}}{${fmt3(cable_dia_in)}}\\right) = \\mathrm{trunc}_{0.5}(${fmt2(raw_wraps)})`));
    lines.push(mcLine('result', `W_{\\mathrm{layer}} = ${fmt1(meta.wraps_per_layer_used)}`));
  }

  lines.push(mcLine('subheading', 'Bare drum diameter (first layer)'));
  if (sym) {
    lines.push(mcLine('assign', 'D_1 := D_{\\mathrm{core}} + 2\\,t_{\\mathrm{lebus}} + d_c'));
  } else {
    lines.push(mcLine('assign', `D_1 := ${fmt3(inp.core_dia_in)} + 2 \\times ${fmt3(inp.lebus_thk_in)} + ${fmt3(cable_dia_in)}`));
    lines.push(mcLine('result', `D_1 = ${fmt3(bare_drum_dia_in)} \\; \\mathrm{in}`));
  }

  lines.push(mcLine('subheading', 'Layer diameter growth'));
  if (sym) {
    lines.push(mcLine('assign', 'D_{\\ell+1} := D_{\\ell} + 2\\,d_c\\,\\phi'));
  } else {
    const growth = 2 * cable_dia_in * (inp.packing_factor || 0.877);
    lines.push(mcLine('assign', `D_{\\ell+1} := D_{\\ell} + 2 \\times ${fmt3(cable_dia_in)} \\times ${fmt3(inp.packing_factor)}`));
    lines.push(mcLine('result', `\\Delta D = ${fmt3(growth)} \\; \\mathrm{in/layer}`));
  }

  lines.push(mcLine('subheading', 'Wrap length'));
  if (sym) {
    lines.push(mcLine('assign', 'L_{\\mathrm{wrap}} := \\pi \\cdot D_{\\ell}'));
  } else {
    lines.push(mcLine('note', `At layer 1 (D₁ = ${fmt3(bare_drum_dia_in)} in):`));
    lines.push(mcLine('assign', `L_{\\mathrm{wrap}} := \\pi \\times ${fmt3(bare_drum_dia_in)}`));
    lines.push(mcLine('result', `L_{\\mathrm{wrap}} = ${fmt3(Math.PI * bare_drum_dia_in)} \\; \\mathrm{in} = ${fmt3(Math.PI * bare_drum_dia_in * M_PER_IN)} \\; \\mathrm{m}`));
  }

  lines.push(mcLine('subheading', 'Summary'));
  if (sym) {
    lines.push(mcLine('note', 'Iterate wraps until all cable is spooled.'));
  } else {
    lines.push(mcLine('result', `\\text{Total layers} = ${fmtInt(summ.total_layers)}`));
    lines.push(mcLine('result', `\\text{Total wraps} = ${fmtInt(summ.total_wraps)}`));
    lines.push(mcLine('result', `D_{\\mathrm{full}} = ${fmt3(summ.full_drum_dia_in)} \\; \\mathrm{in}`));
  }

  // =====================================================
  // SECTION C: LINE TENSION
  // =====================================================
  lines.push(mcLine('heading', 'C) Line Tension'));

  if (sym) {
    lines.push(mcLine('assign', 'T(z) := m_{\\mathrm{payload}} + w_c \\cdot z_{\\mathrm{deployed}}'));
  } else {
    lines.push(mcLine('assign', `T(z) := ${fmt1(inp.payload_kg)} + ${fmt3(inp.cable_w_kgpm)} \\cdot z_{\\mathrm{deployed}}`));
    lines.push(mcLine('note', `At bare drum (z = ${fmt1(r0.deployed_len_m)} m):`));
    lines.push(mcLine('result', `T_{\\mathrm{bare}} = ${fmt1(r0.tension_kgf)} \\; \\mathrm{kgf}`));
    lines.push(mcLine('note', `At full drum (z = ${fmt1(rN.deployed_len_m)} m):`));
    lines.push(mcLine('result', `T_{\\mathrm{full}} = ${fmt1(rN.tension_kgf)} \\; \\mathrm{kgf}`));
  }

  // =====================================================
  // SECTION D: DRUM & DRIVETRAIN TORQUE
  // =====================================================
  lines.push(mcLine('heading', 'D) Drum &amp; Drivetrain Torque'));

  lines.push(mcLine('subheading', 'Drum torque'));
  if (sym) {
    lines.push(mcLine('assign', '\\tau_{\\mathrm{drum}} := T \\cdot g \\cdot r_{\\ell}'));
    lines.push(mcLine('note', `where g = 9.80665 m/s² and r<sub>ℓ</sub> = D<sub>ℓ</sub> × 0.0254 / 2`));
  } else {
    const r0_m = (r0.layer_dia_in * M_PER_IN) / 2;
    const tau_drum_0 = r0.tension_kgf * G * r0_m;
    lines.push(mcLine('assign', `\\tau_{\\mathrm{drum}} := T \\cdot ${fmt4(G)} \\cdot r_{\\ell}`));
    lines.push(mcLine('note', `At bare drum (r = ${fmt4(r0_m)} m, T = ${fmt1(r0.tension_kgf)} kgf):`));
    lines.push(mcLine('result', `\\tau_{\\mathrm{drum}} = ${fmt1(r0.tension_kgf)} \\times ${fmt4(G)} \\times ${fmt4(r0_m)} = ${fmt1(tau_drum_0)} \\; \\mathrm{N{\\cdot}m}`));
  }

  lines.push(mcLine('subheading', 'Gearbox torque'));
  if (sym) {
    lines.push(mcLine('assign', '\\tau_{\\mathrm{gearbox}} := \\frac{\\tau_{\\mathrm{drum}}}{N_m \\cdot G_2}'));
  } else {
    lines.push(mcLine('assign', `\\tau_{\\mathrm{gearbox}} := \\frac{\\tau_{\\mathrm{drum}}}{${fmtInt(motors)} \\times ${fmt3(gr2)}}`));
    if (Number.isFinite(r0.gearbox_torque_Nm)) {
      lines.push(mcLine('result', `\\tau_{\\mathrm{gearbox,bare}} = ${fmt1(r0.gearbox_torque_Nm)} \\; \\mathrm{N{\\cdot}m}`));
    }
  }

  lines.push(mcLine('subheading', 'Motor torque'));
  if (sym) {
    lines.push(mcLine('assign', '\\tau_{\\mathrm{motor}} := \\frac{\\tau_{\\mathrm{drum}}}{G_1 \\cdot G_2 \\cdot N_m}'));
  } else {
    lines.push(mcLine('assign', `\\tau_{\\mathrm{motor}} := \\frac{\\tau_{\\mathrm{drum}}}{${fmt3(gr1)} \\times ${fmt3(gr2)} \\times ${fmtInt(motors)}}`));
    if (model.electricEnabled && Number.isFinite(r0.motor_torque_Nm)) {
      lines.push(mcLine('result', `\\tau_{\\mathrm{motor,bare}} = ${fmt2(r0.motor_torque_Nm)} \\; \\mathrm{N{\\cdot}m}`));
    }
  }

  // =====================================================
  // SECTION E: ELECTRIC DRIVE
  // =====================================================
  if (model.electricEnabled) {
    lines.push(mcLine('heading', 'E) Electric Drive — Speed &amp; Tension'));

    const P_per_motor_W = (inp.motor_hp || 0) * (inp.motor_eff || 1) * W_PER_HP;

    lines.push(mcLine('subheading', 'Motor power'));
    if (sym) {
      lines.push(mcLine('assign', 'P_{\\mathrm{motor}} := \\mathrm{HP}_{\\mathrm{motor}} \\cdot \\eta_{\\mathrm{motor}} \\cdot 745.7'));
    } else {
      lines.push(mcLine('assign', `P_{\\mathrm{motor}} := ${fmt1(inp.motor_hp)} \\times ${fmt3(inp.motor_eff)} \\times 745.7`));
      lines.push(mcLine('result', `P_{\\mathrm{motor}} = ${fmt1(P_per_motor_W)} \\; \\mathrm{W}`));
    }

    lines.push(mcLine('subheading', 'Power-limited motor RPM'));
    if (sym) {
      lines.push(mcLine('assign', '\\omega_{\\mathrm{power}} := \\frac{P_{\\mathrm{motor}} \\cdot 60}{2\\pi \\cdot \\tau_{\\mathrm{motor}}}'));
    } else {
      if (r0.motor_torque_Nm > 0) {
        const rpm_power = (P_per_motor_W / r0.motor_torque_Nm) * 60 / (2 * Math.PI);
        lines.push(mcLine('assign', `\\omega_{\\mathrm{power}} := \\frac{${fmt1(P_per_motor_W)} \\times 60}{2\\pi \\times ${fmt2(r0.motor_torque_Nm)}}`));
        lines.push(mcLine('result', `\\omega_{\\mathrm{power,bare}} = ${fmt1(rpm_power)} \\; \\mathrm{rpm}`));
      }
    }

    lines.push(mcLine('subheading', 'Line speed from motor RPM'));
    if (sym) {
      lines.push(mcLine('assign', 'v := \\pi \\cdot D_{\\ell} \\cdot \\frac{\\omega_{\\mathrm{motor}}}{G_1 \\cdot G_2}'));
    } else {
      lines.push(mcLine('note', `Using D₁ = ${fmt3(r0.layer_dia_in)} in = ${fmt4(r0.layer_dia_in * M_PER_IN)} m:`));
      lines.push(mcLine('result', `v_{\\mathrm{bare}} = ${fmt2(r0.el_speed_available_mpm)} \\; \\mathrm{m/min}`));
    }

    lines.push(mcLine('subheading', 'Available line speed'));
    if (sym) {
      lines.push(mcLine('assign', 'v_{\\mathrm{avail}} := \\min\\!\\left(v_{P},\\; v_{\\mathrm{max\\text{-}RPM}}\\right)'));
    } else {
      lines.push(mcLine('note', `At bare drum:`));
      lines.push(mcLine('result', `v_P = ${fmt2(r0.el_speed_power_mpm)} \\; \\mathrm{m/min} \\qquad v_{\\mathrm{RPM}} = ${fmt2(r0.el_speed_gearbox_mpm)} \\; \\mathrm{m/min}`));
      lines.push(mcLine('result', `v_{\\mathrm{avail}} = ${fmt2(r0.el_speed_available_mpm)} \\; \\mathrm{m/min}`));
    }

    lines.push(mcLine('subheading', 'Available line tension'));
    if (sym) {
      lines.push(mcLine('assign', 'T_{\\mathrm{avail}} := \\frac{\\tau_{\\mathrm{motor,max}} \\cdot G_1 \\cdot G_2 \\cdot N_m}{r_{\\ell} \\cdot g}'));
    } else {
      lines.push(mcLine('note', `At bare drum (r = ${fmt4((r0.layer_dia_in * M_PER_IN) / 2)} m):`));
      lines.push(mcLine('result', `T_{\\mathrm{avail}} = ${fmt1(r0.avail_tension_kgf)} \\; \\mathrm{kgf}`));
    }
  }

  // =====================================================
  // SECTION F: HYDRAULIC DRIVE
  // =====================================================
  if (model.hydraulicEnabled) {
    lines.push(mcLine('heading', 'F) Hydraulic Drive — Speed, Pressure &amp; Tension'));

    lines.push(mcLine('subheading', 'System flow'));
    if (sym) {
      lines.push(mcLine('assign', 'Q_{\\mathrm{string}} := \\frac{\\delta_p \\cdot \\omega_e}{3785.41}'));
      lines.push(mcLine('assign', 'Q_{\\mathrm{total}} := Q_{\\mathrm{string}} \\cdot N_{\\mathrm{strings}}'));
    } else {
      const q_string = (hy.h_pump_cc * hy.h_emotor_rpm) / CC_PER_GAL;
      lines.push(mcLine('assign', `Q_{\\mathrm{string}} := \\frac{${fmt1(hy.h_pump_cc)} \\times ${fmt1(hy.h_emotor_rpm)}}{3785.41}`));
      lines.push(mcLine('result', `Q_{\\mathrm{string}} = ${fmt2(q_string)} \\; \\mathrm{gpm}`));
      lines.push(mcLine('assign', `Q_{\\mathrm{total}} := ${fmt2(q_string)} \\times ${fmtInt(hy.h_strings)}`));
      lines.push(mcLine('result', `Q_{\\mathrm{total}} = ${fmt2(hy.q_tot_gpm)} \\; \\mathrm{gpm}`));
    }

    lines.push(mcLine('subheading', 'Power-limited flow'));
    if (sym) {
      lines.push(mcLine('assign', 'Q_{\\mathrm{power}} := \\frac{\\mathrm{HP}_{\\mathrm{total}} \\cdot 1714}{P_{\\max}}'));
    } else {
      const hp_tot = hy.h_emotor_hp * hy.h_emotor_eff * hy.h_strings;
      const q_power = hy.h_max_psi > 0 ? (hp_tot * 1714) / hy.h_max_psi : Infinity;
      lines.push(mcLine('assign', `Q_{\\mathrm{power}} := \\frac{${fmt1(hp_tot)} \\times 1714}{${fmtInt(hy.h_max_psi)}}`));
      lines.push(mcLine('result', `Q_{\\mathrm{power}} = ${fmt2(q_power)} \\; \\mathrm{gpm}`));
    }

    lines.push(mcLine('subheading', 'Flow-limited hydraulic motor RPM'));
    if (sym) {
      lines.push(mcLine('assign', '\\omega_{\\mathrm{m,flow}} := \\min\\!\\left(\\omega_{\\mathrm{cap}},\\; \\frac{Q_{\\mathrm{total}} \\cdot 3785.41}{N_m \\cdot \\delta_m}\\right)'));
    } else {
      lines.push(mcLine('result', `\\omega_{\\mathrm{m,flow}} = ${fmt1(hy.rpm_flow_per_motor_available)} \\; \\mathrm{rpm}`));
    }

    lines.push(mcLine('subheading', 'Flow-limited line speed'));
    if (sym) {
      lines.push(mcLine('assign', 'v_Q := \\pi \\cdot D_{\\ell} \\cdot \\frac{\\omega_{\\mathrm{m,flow}}}{G_1 \\cdot G_2}'));
    } else {
      lines.push(mcLine('note', `At bare drum:`));
      lines.push(mcLine('result', `v_Q = ${fmt2(r0.hyd_speed_flow_mpm)} \\; \\mathrm{m/min}`));
    }

    lines.push(mcLine('subheading', 'Power-limited line speed'));
    if (sym) {
      lines.push(mcLine('assign', 'v_P := \\frac{\\mathrm{HP}_e \\cdot N_{\\mathrm{strings}} \\cdot \\eta_e \\cdot 745.7}{T \\cdot g} \\cdot 60'));
    } else {
      lines.push(mcLine('note', `At bare drum:`));
      lines.push(mcLine('result', `v_P = ${fmt2(r0.hyd_speed_power_mpm)} \\; \\mathrm{m/min}`));
    }

    lines.push(mcLine('subheading', 'Available line speed'));
    if (sym) {
      lines.push(mcLine('assign', 'v_{\\mathrm{avail}} := \\min\\!\\left(v_P,\\; v_Q\\right)'));
    } else {
      lines.push(mcLine('result', `v_{\\mathrm{avail,bare}} = ${fmt2(r0.hyd_speed_available_mpm)} \\; \\mathrm{m/min}`));
    }

    lines.push(mcLine('subheading', 'Required pressure'));
    if (sym) {
      lines.push(mcLine('assign', '\\Delta p := \\frac{\\tau_{\\mathrm{h\\text{-}motor}} \\cdot 2\\pi}{\\delta_m \\times 10^{-6}} \\cdot \\frac{1}{6894.76}'));
    } else {
      lines.push(mcLine('note', `At bare drum:`));
      lines.push(mcLine('result', `\\Delta p = ${fmtInt(r0.hyd_P_required_psi)} \\; \\mathrm{psi}`));
    }

    lines.push(mcLine('subheading', 'Available tension from max pressure'));
    if (sym) {
      lines.push(mcLine('assign', '\\tau_{\\mathrm{h,max}} := \\frac{\\Delta p_{\\max} \\cdot 6894.76 \\cdot \\delta_m \\times 10^{-6}}{2\\pi}'));
      lines.push(mcLine('assign', 'T_{\\mathrm{avail}} := \\frac{\\tau_{\\mathrm{h,max}} \\cdot G_1 \\cdot G_2 \\cdot N_m}{r_{\\ell} \\cdot g}'));
    } else {
      lines.push(mcLine('result', `\\tau_{\\mathrm{h,max}} = ${fmt1(hy.torque_per_hmotor_maxP)} \\; \\mathrm{N{\\cdot}m/motor}`));
      lines.push(mcLine('note', `At bare drum:`));
      lines.push(mcLine('result', `T_{\\mathrm{avail}} = ${fmt1(r0.hyd_avail_tension_kgf)} \\; \\mathrm{kgf}`));
    }

    lines.push(mcLine('subheading', 'Hydraulic power consumed'));
    if (sym) {
      lines.push(mcLine('assign', '\\mathrm{HP}_{\\mathrm{hyd}} := \\frac{\\Delta p_{\\mathrm{op}} \\cdot Q_{\\mathrm{used}}}{1714}'));
    } else {
      lines.push(mcLine('note', `At bare drum:`));
      lines.push(mcLine('result', `\\mathrm{HP}_{\\mathrm{hyd}} = ${fmt2(r0.hyd_hp_used_at_available)} \\; \\mathrm{hp}`));
    }
  }

  // =====================================================
  // SECTION G: DYNAMIC LOADS
  // =====================================================
  const dynEnabled = rows[0] && rows[0].J_total_kgm2 > 0;
  if (dynEnabled) {
    lines.push(mcLine('heading', 'G) Dynamic Loads — Inertia &amp; Acceleration'));

    lines.push(mcLine('subheading', 'Cable moment of inertia'));
    if (sym) {
      lines.push(mcLine('assign', 'J_{\\mathrm{cable}} := \\tfrac{1}{2}\\,m_{\\mathrm{cable}}\\!\\left(r_{\\mathrm{layer}}^2 + r_{\\mathrm{core}}^2\\right)'));
    } else {
      const core_r_m = ((inp.core_dia_in || 0) + 2 * (inp.lebus_thk_in || 0)) * M_PER_IN / 2;
      lines.push(mcLine('assign', `J_{\\mathrm{cable}} := \\tfrac{1}{2} \\cdot m_{\\mathrm{cable}} \\cdot \\left(r_{\\mathrm{layer}}^2 + ${fmt4(core_r_m)}^2\\right)`));
    }

    lines.push(mcLine('subheading', 'Total inertia'));
    if (sym) {
      lines.push(mcLine('assign', 'J_{\\mathrm{total}} := J_{\\mathrm{drum}} + J_{\\mathrm{cable}}'));
    } else {
      lines.push(mcLine('note', `At bare drum:`));
      lines.push(mcLine('result', `J_{\\mathrm{total}} = ${fmt2(r0.J_total_kgm2)} \\; \\mathrm{kg{\\cdot}m^2}`));
    }

    lines.push(mcLine('subheading', 'Torque margin &amp; acceleration'));
    if (sym) {
      lines.push(mcLine('assign', '\\tau_{\\mathrm{margin}} := \\tau_{\\mathrm{avail}} - \\tau_{\\mathrm{drum,static}}'));
      lines.push(mcLine('assign', 'a := \\frac{\\tau_{\\mathrm{margin}}}{J_{\\mathrm{total}}} \\cdot r_{\\ell}'));
    } else {
      lines.push(mcLine('note', `At bare drum:`));
      lines.push(mcLine('result', `\\tau_{\\mathrm{margin}} = ${fmt1(r0.tau_margin_Nm)} \\; \\mathrm{N{\\cdot}m}`));
      lines.push(mcLine('result', `a = ${fmt3(r0.avail_accel_mps2)} \\; \\mathrm{m/s^2}`));
    }
  }

  // =====================================================
  // SECTION H: TORQUE COMPLIANCE
  // =====================================================
  lines.push(mcLine('heading', `${dynEnabled ? 'H' : 'G'}) Torque Compliance Checks`));

  lines.push(mcLine('subheading', 'FAT drum torque'));
  if (sym) {
    lines.push(mcLine('assign', '\\tau_{\\mathrm{FAT}} := T_{\\mathrm{SWL}} \\cdot 1.25 \\cdot g \\cdot \\frac{D_{\\mathrm{full}}}{2} \\cdot 0.0254'));
  } else {
    const fullR_m = (summ.full_drum_dia_in * M_PER_IN) / 2;
    lines.push(mcLine('assign', `\\tau_{\\mathrm{FAT}} := T_{\\mathrm{SWL}} \\cdot 1.25 \\cdot ${fmt4(G)} \\cdot ${fmt4(fullR_m)}`));
  }

  lines.push(mcLine('subheading', 'Operating peak drum torque'));
  if (sym) {
    lines.push(mcLine('assign', '\\tau_{\\mathrm{ops}} := \\max_{\\ell}\\!\\left(\\tau_{\\mathrm{drum,max,}\\ell}\\right)'));
  } else {
    let maxTorque = 0;
    for (const r of rows) if (r.torque_Nm > maxTorque) maxTorque = r.torque_Nm;
    lines.push(mcLine('result', `\\tau_{\\mathrm{ops}} = ${fmt1(maxTorque)} \\; \\mathrm{N{\\cdot}m}`));
  }

  lines.push(mcLine('subheading', 'Design worst-case'));
  if (sym) {
    lines.push(mcLine('assign', '\\tau_{\\mathrm{design}} := \\max\\!\\left(\\tau_{\\mathrm{FAT}},\\; \\tau_{\\mathrm{ops}}\\right)'));
    lines.push(mcLine('note', 'Divide through gear train to check gearbox and motor ratings.'));
  } else {
    lines.push(mcLine('note', 'Compare to gearbox and motor ratings through gear train.'));
  }

  container.innerHTML = lines.join('\n');
}
