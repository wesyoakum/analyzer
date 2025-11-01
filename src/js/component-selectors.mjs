// ===== component-selectors.mjs — predefined component selections =====

/**
 * @typedef {Object} ComponentOption
 * @property {string} pn
 * @property {string} [description]
 * @property {number|string|boolean} [gear_ratio_stage1]
 * @property {number|string|boolean} [gear_ratio_stage2]
 * @property {number|string|boolean} [motor_max_rpm]
 * @property {number|string|boolean} [motor_hp]
 * @property {number|string|boolean} [motor_tmax_Nm]
 * @property {number|string|boolean} [pump_disp_cc]
 * @property {number|string|boolean} [pump_max_psi]
 * @property {number|string|boolean} [hyd_motor_disp_cc]
 * @property {number|string|boolean} [hyd_motor_max_rpm]
  * @property {number|string|boolean} [motor_eff]
  * @property {number|string|boolean} [c_mm]
  * @property {number|string|boolean} [depth_m]
  * @property {number|string|boolean} [dead_m]
  * @property {number|string|boolean} [c_w_kgpm]
  * @property {number|string|boolean} [core_in]
  * @property {number|string|boolean} [ftf_in]
  * @property {number|string|boolean} [lebus_in]
  * @property {number|string|boolean} [pack]
  * @property {number|string|boolean} [wraps_override]
  * @property {number|string|boolean} [motors]
  * @property {number|string|boolean} [h_pump_strings]
  * @property {string} [gearbox_select]
  * @property {string} [electric_motor_select]
  * @property {string} [hydraulic_pump_select]
  * @property {string} [hydraulic_motor_select]
  * @property {string} [cable_select]
  * @property {string} [drum_select]
  * @property {string} [payload_select]
  * @property {string} [hpu_select]
  * @property {string} [hpu_motor_select]
 */

/**
 * @typedef {Object} SelectConfig
 * @property {string} selectId
 * @property {ComponentOption[]} options
 * @property {Record<string, keyof ComponentOption>} fieldMap
 * @property {boolean} [initialSkipEvents]
 */

/** @type {ComponentOption[]} */
export const CABLE_OPTIONS = [
  {
    pn: 'CB-30-3000',
    description: '30 mm × 3000 m, 100 m dead, 3.8 kg/m',
    c_mm: 30,
    depth_m: 3000,
    dead_m: 100,
    c_w_kgpm: 3.8
  },
  {
    pn: 'CB-32-3500',
    description: '32 mm × 3500 m, 120 m dead, 4.2 kg/m',
    c_mm: 32,
    depth_m: 3500,
    dead_m: 120,
    c_w_kgpm: 4.2
  },
  {
    pn: 'CB-28-2500',
    description: '28 mm × 2500 m, 80 m dead, 3.1 kg/m',
    c_mm: 28,
    depth_m: 2500,
    dead_m: 80,
    c_w_kgpm: 3.1
  }
];

/** @type {ComponentOption[]} */
export const DRUM_OPTIONS = [
  {
    pn: 'DR-64-116',
    description: '64 in core, 116 in FTF, 0.625 in liner',
    core_in: 64,
    ftf_in: 116,
    lebus_in: 0.625,
    pack: 0.877,
    wraps_override: 40
  },
  {
    pn: 'DR-705-118',
    description: '70.5 in core, 118 in FTF, 0.75 in liner',
    core_in: 70.5,
    ftf_in: 118,
    lebus_in: 0.75,
    pack: 0.88,
    wraps_override: 38.5
  },
  {
    pn: 'DR-82-132',
    description: '82 in core, 132 in FTF, 0.6 in liner',
    core_in: 82,
    ftf_in: 132,
    lebus_in: 0.6,
    pack: 0.9,
    wraps_override: 36
  }
];

/** @type {ComponentOption[]} */
export const PAYLOAD_OPTIONS = [
  {
    pn: 'PL-8000',
    description: '8 tonne subsea package',
    payload_kg: 8000
  },
  {
    pn: 'PL-6000',
    description: '6 tonne instrument frame',
    payload_kg: 6000
  },
  {
    pn: 'PL-10000',
    description: '10 tonne lift module',
    payload_kg: 10000
  }
];

/** @type {ComponentOption[]} */
export const GEARBOX_OPTIONS = [
  {
    pn: 'GB-123',
    description: 'Single stage 20:1 (overall)',
    gear_ratio_stage1: 20,
    gear_ratio_stage2: 1
  },
  {
    pn: 'GB-2050',
    description: 'Planetary 20:1 × 5:1 (100:1 overall)',
    gear_ratio_stage1: 20,
    gear_ratio_stage2: 5
  },
  {
    pn: 'GB-1550',
    description: 'Compound 15:1 × 5:1 (75:1 overall)',
    gear_ratio_stage1: 15,
    gear_ratio_stage2: 5
  },
  {
    pn: 'GB-1250',
    description: 'High-speed 12.5:1 × 5:1 (62.5:1 overall)',
    gear_ratio_stage1: 12.5,
    gear_ratio_stage2: 5
  }
];

/** @type {ComponentOption[]} */
export const ELECTRIC_MOTOR_OPTIONS = [
  {
    pn: 'EM-150-4P',
    description: '150 hp, 1800 rpm, 230 N·m',
    motor_hp: 150,
    motor_max_rpm: 1800,
    motor_tmax_Nm: 230,
    motor_eff: 0.95
  },
  {
    pn: 'EM-200-4P',
    description: '200 hp, 1785 rpm, 310 N·m',
    motor_hp: 200,
    motor_max_rpm: 1785,
    motor_tmax_Nm: 310,
    motor_eff: 0.94
  },
  {
    pn: 'EM-250-6P',
    description: '250 hp, 1200 rpm, 430 N·m',
    motor_hp: 250,
    motor_max_rpm: 1200,
    motor_tmax_Nm: 430,
    motor_eff: 0.93
  }
];

/** @type {ComponentOption[]} */
export const HYDRAULIC_PUMP_OPTIONS = [
  {
    pn: 'HP-210A',
    description: '210 cc/rev, 3500 psi',
    pump_disp_cc: 210,
    pump_max_psi: 3500
  },
  {
    pn: 'HP-180B',
    description: '180 cc/rev, 4000 psi',
    pump_disp_cc: 180,
    pump_max_psi: 4000
  },
  {
    pn: 'HP-250C',
    description: '250 cc/rev, 3200 psi',
    pump_disp_cc: 250,
    pump_max_psi: 3200
  }
];

/** @type {ComponentOption[]} */
export const HYDRAULIC_MOTOR_OPTIONS = [
  {
    pn: 'HM-1234',
    description: '55 cc/rev, 2300 rpm',
    hyd_motor_disp_cc: 55,
    hyd_motor_max_rpm: 2300
  },
  {
    pn: 'HM-1580',
    description: '80 cc/rev, 1900 rpm',
    hyd_motor_disp_cc: 80,
    hyd_motor_max_rpm: 1900
  },
  {
    pn: 'HM-2090',
    description: '95 cc/rev, 1600 rpm',
    hyd_motor_disp_cc: 95,
    hyd_motor_max_rpm: 1600
  }
];

/** @type {ComponentOption[]} */
export const HPU_MOTOR_OPTIONS = [
  {
    pn: 'HMOT-75-1780',
    description: '75 hp @ 1780 rpm',
    h_emotor_hp: 75,
    h_emotor_rpm: 1780
  },
  {
    pn: 'HMOT-90-1785',
    description: '90 hp @ 1785 rpm',
    h_emotor_hp: 90,
    h_emotor_rpm: 1785
  },
  {
    pn: 'HMOT-110-1200',
    description: '110 hp @ 1200 rpm',
    h_emotor_hp: 110,
    h_emotor_rpm: 1200
  }
];

/** @type {ComponentOption[]} */
export const HPU_OPTIONS = [
  {
    pn: 'HPU-2S-210',
    description: '2 strings, HMOT-75-1780, pump HP-210A',
    h_pump_strings: 2,
    hpu_motor_select: 'HMOT-75-1780',
    hydraulic_pump_select: 'HP-210A'
  },
  {
    pn: 'HPU-3S-180',
    description: '3 strings, HMOT-90-1785, pump HP-180B',
    h_pump_strings: 3,
    hpu_motor_select: 'HMOT-90-1785',
    hydraulic_pump_select: 'HP-180B'
  },
  {
    pn: 'HPU-2S-250',
    description: '2 strings, HMOT-110-1200, pump HP-250C',
    h_pump_strings: 2,
    hpu_motor_select: 'HMOT-110-1200',
    hydraulic_pump_select: 'HP-250C'
  }
];

/** @type {ComponentOption[]} */
export const SYSTEM_OPTIONS = [
  {
    pn: 'WINCH-513',
    description: 'Placeholder 513 Winch system',
    cable_select: 'CB-30-3000',
    drum_select: 'DR-705-118',
    payload_select: 'PL-8000',
    hpu_select: 'HPU-2S-210',
    hpu_motor_select: 'HMOT-75-1780',
    core_in: 70.5,
    ftf_in: 118,
    lebus_in: 0.75,
    pack: 0.88,
    motors: 6,
    h_pump_strings: 2,
    gearbox_select: 'GB-123',
    electric_motor_select: 'EM-200-4P',
    hydraulic_pump_select: 'HP-210A',
    hydraulic_motor_select: 'HM-1580'
  },
  {
    pn: 'WINCH-900',
    description: 'Placeholder 900 Winch system',
    cable_select: 'CB-32-3500',
    drum_select: 'DR-82-132',
    payload_select: 'PL-10000',
    hpu_select: 'HPU-2S-250',
    hpu_motor_select: 'HMOT-110-1200',
    core_in: 82,
    ftf_in: 132,
    lebus_in: 0.6,
    pack: 0.9,
    motors: 4,
    h_pump_strings: 3,
    gearbox_select: 'GB-2050',
    electric_motor_select: 'EM-250-6P',
    hydraulic_pump_select: 'HP-250C',
    hydraulic_motor_select: 'HM-2090'
  }
];

export const FIELD_MAPS = {
  cable: /** @type {SelectConfig['fieldMap']} */ ({
    c_mm: 'c_mm',
    depth_m: 'depth_m',
    dead_m: 'dead_m',
    c_w_kgpm: 'c_w_kgpm'
  }),
  drum: /** @type {SelectConfig['fieldMap']} */ ({
    core_in: 'core_in',
    ftf_in: 'ftf_in',
    lebus_in: 'lebus_in',
    pack: 'pack',
    wraps_override: 'wraps_override'
  }),
  payload: /** @type {SelectConfig['fieldMap']} */ ({
    payload_kg: 'payload_kg'
  }),
  gearbox: /** @type {SelectConfig['fieldMap']} */ ({
    gr1: 'gear_ratio_stage1',
    gr2: 'gear_ratio_stage2'
  }),
  electricMotor: /** @type {SelectConfig['fieldMap']} */ ({
    motor_eff: 'motor_eff',
    motor_max_rpm: 'motor_max_rpm',
    motor_hp: 'motor_hp',
    motor_tmax: 'motor_tmax_Nm'
  }),
  hydraulicPump: /** @type {SelectConfig['fieldMap']} */ ({
    h_pump_cc: 'pump_disp_cc',
    h_max_psi: 'pump_max_psi'
  }),
  hydraulicMotor: /** @type {SelectConfig['fieldMap']} */ ({
    h_hmot_cc: 'hyd_motor_disp_cc',
    h_hmot_rpm_max: 'hyd_motor_max_rpm'
  }),
  hpuMotor: /** @type {SelectConfig['fieldMap']} */ ({
    h_emotor_hp: 'h_emotor_hp',
    h_emotor_rpm: 'h_emotor_rpm'
  }),
  hpu: /** @type {SelectConfig['fieldMap']} */ ({
    h_pump_strings: 'h_pump_strings',
    hpu_motor_select: 'hpu_motor_select',
    hydraulic_pump_select: 'hydraulic_pump_select'
  }),
  system: /** @type {SelectConfig['fieldMap']} */ ({
    cable_select: 'cable_select',
    drum_select: 'drum_select',
    payload_select: 'payload_select',
    core_in: 'core_in',
    ftf_in: 'ftf_in',
    lebus_in: 'lebus_in',
    pack: 'pack',
    motors: 'motors',
    h_pump_strings: 'h_pump_strings',
    hpu_select: 'hpu_select',
    hpu_motor_select: 'hpu_motor_select',
    gearbox_select: 'gearbox_select',
    electric_motor_select: 'electric_motor_select',
    hydraulic_pump_select: 'hydraulic_pump_select',
    hydraulic_motor_select: 'hydraulic_motor_select'
  })
};

/** @type {SelectConfig[]} */
const SELECT_CONFIGS = [
  {
    selectId: 'cable_select',
    options: CABLE_OPTIONS,
    fieldMap: FIELD_MAPS.cable
  },
  {
    selectId: 'drum_select',
    options: DRUM_OPTIONS,
    fieldMap: FIELD_MAPS.drum
  },
  {
    selectId: 'payload_select',
    options: PAYLOAD_OPTIONS,
    fieldMap: FIELD_MAPS.payload
  },
  {
    selectId: 'gearbox_select',
    options: GEARBOX_OPTIONS,
    fieldMap: FIELD_MAPS.gearbox
  },
  {
    selectId: 'electric_motor_select',
    options: ELECTRIC_MOTOR_OPTIONS,
    fieldMap: FIELD_MAPS.electricMotor
  },
  {
    selectId: 'hpu_motor_select',
    options: HPU_MOTOR_OPTIONS,
    fieldMap: FIELD_MAPS.hpuMotor
  },
  {
    selectId: 'hpu_select',
    options: HPU_OPTIONS,
    fieldMap: FIELD_MAPS.hpu
  },
  {
    selectId: 'hydraulic_pump_select',
    options: HYDRAULIC_PUMP_OPTIONS,
    fieldMap: FIELD_MAPS.hydraulicPump
  },
  {
    selectId: 'hydraulic_motor_select',
    options: HYDRAULIC_MOTOR_OPTIONS,
    fieldMap: FIELD_MAPS.hydraulicMotor
  },
  {
    selectId: 'system_select',
    options: SYSTEM_OPTIONS,
    fieldMap: FIELD_MAPS.system,
    initialSkipEvents: false
  }
];

const watchedInputs = new Set();

function describeOption(config, option) {
  const parts = [option.pn];
  if (option.description) parts.push(option.description);
  return parts.join(' — ');
}

function attachWatcher(inputId) {
  if (watchedInputs.has(inputId)) return;
  const el = /** @type {HTMLElement|null} */ (document.getElementById(inputId));
  if (!el) return;
  const handler = () => {
    if (el.dataset.componentSuppress === '1') return;
    const selectId = el.dataset.componentSelect;
    if (!selectId) return;
    delete el.dataset.componentSelect;
    delete el.dataset.componentPn;
    const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(selectId));
    if (selectEl && selectEl.value) {
      selectEl.value = '';
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  if (el instanceof HTMLInputElement) {
    const type = el.type;
    if (type === 'checkbox' || type === 'radio' || type === 'range' || type === 'color') {
      el.addEventListener('change', handler);
    } else {
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    }
  } else if (el instanceof HTMLSelectElement) {
    el.addEventListener('change', handler);
  } else if (el instanceof HTMLTextAreaElement) {
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  } else {
    el.addEventListener('change', handler);
  }
  watchedInputs.add(inputId);
}

function applySelection(config, pn, { skipEvents = false } = {}) {
  const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(config.selectId));
  if (!selectEl) return;
  const option = config.options.find(opt => opt.pn === pn);
  const fieldEntries = Object.entries(config.fieldMap);
  if (!option) {
    fieldEntries.forEach(([inputId]) => {
      const inputEl = /** @type {HTMLElement|null} */ (document.getElementById(inputId));
      if (!inputEl) return;
      if (inputEl.dataset.componentSelect === config.selectId) {
        delete inputEl.dataset.componentSelect;
        delete inputEl.dataset.componentPn;
      }
    });
    return;
  }

  fieldEntries.forEach(([inputId, optionKey]) => {
    const inputEl = /** @type {HTMLElement|null} */ (document.getElementById(inputId));
    if (!inputEl) return;
    const value = option[optionKey];
    if (value == null) return;
    inputEl.dataset.componentSelect = config.selectId;
    inputEl.dataset.componentPn = option.pn;
    inputEl.dataset.componentSuppress = '1';
    if (inputEl instanceof HTMLInputElement) {
      if (inputEl.type === 'checkbox') {
        inputEl.checked = Boolean(value);
      } else {
        inputEl.value = String(value);
      }
    } else if (inputEl instanceof HTMLSelectElement || inputEl instanceof HTMLTextAreaElement) {
      inputEl.value = String(value);
    } else {
      inputEl.textContent = String(value);
    }
    if (!skipEvents) {
      if (inputEl instanceof HTMLInputElement) {
        if (inputEl.type !== 'checkbox' && inputEl.type !== 'radio' && inputEl.type !== 'range' && inputEl.type !== 'color') {
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    delete inputEl.dataset.componentSuppress;
  });
}

export function setupComponentSelectors() {
  SELECT_CONFIGS.forEach(config => {
    const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(config.selectId));
    if (!selectEl) return;
    const initialValue = selectEl.value;
    const { initialSkipEvents = true } = config;

    // Populate the select list
    // Clear any existing dynamic options while preserving the first custom option
    const firstOption = selectEl.querySelector('option');
    selectEl.innerHTML = '';
    if (firstOption && firstOption.value === '') {
      selectEl.appendChild(firstOption);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Custom (manual input)';
      selectEl.appendChild(opt);
    }

    config.options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.pn;
      opt.textContent = describeOption(config, option);
      selectEl.appendChild(opt);
    });

    selectEl.value = initialValue;

    Object.keys(config.fieldMap).forEach(inputId => attachWatcher(inputId));

    selectEl.addEventListener('change', () => {
      applySelection(config, selectEl.value);
    });

    // Apply persisted selection if present
    if (selectEl.value) {
      applySelection(config, selectEl.value, { skipEvents: initialSkipEvents });
    }
  });
}
