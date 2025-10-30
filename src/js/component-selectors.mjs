// ===== component-selectors.mjs — predefined component selections =====

/**
 * @typedef {Object} ComponentOption
 * @property {string} pn
 * @property {string} [description]
 * @property {number} [gear_ratio_stage1]
 * @property {number} [gear_ratio_stage2]
 * @property {number} [motor_max_rpm]
 * @property {number} [motor_hp]
 * @property {number} [motor_tmax_Nm]
 * @property {number} [pump_disp_cc]
 * @property {number} [pump_max_psi]
 * @property {number} [hyd_motor_disp_cc]
 * @property {number} [hyd_motor_max_rpm]
 */

const SELECT_CONFIGS = [
  {
    selectId: 'gearbox_select',
    options: [
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
    ],
    fieldMap: {
      gr1: 'gear_ratio_stage1',
      gr2: 'gear_ratio_stage2'
    }
  },
  {
    selectId: 'electric_motor_select',
    options: [
      {
        pn: 'EM-150-4P',
        description: '150 hp, 1800 rpm, 230 N·m',
        motor_hp: 150,
        motor_max_rpm: 1800,
        motor_tmax_Nm: 230
      },
      {
        pn: 'EM-200-4P',
        description: '200 hp, 1785 rpm, 310 N·m',
        motor_hp: 200,
        motor_max_rpm: 1785,
        motor_tmax_Nm: 310
      },
      {
        pn: 'EM-250-6P',
        description: '250 hp, 1200 rpm, 430 N·m',
        motor_hp: 250,
        motor_max_rpm: 1200,
        motor_tmax_Nm: 430
      }
    ],
    fieldMap: {
      motor_max_rpm: 'motor_max_rpm',
      motor_hp: 'motor_hp',
      motor_tmax: 'motor_tmax_Nm'
    }
  },
  {
    selectId: 'hydraulic_pump_select',
    options: [
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
    ],
    fieldMap: {
      h_pump_cc: 'pump_disp_cc',
      h_max_psi: 'pump_max_psi'
    }
  },
  {
    selectId: 'hydraulic_motor_select',
    options: [
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
    ],
    fieldMap: {
      h_hmot_cc: 'hyd_motor_disp_cc',
      h_hmot_rpm_max: 'hyd_motor_max_rpm'
    }
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
  const el = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));
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
  el.addEventListener('input', handler);
  el.addEventListener('change', handler);
  watchedInputs.add(inputId);
}

function applySelection(config, pn, { skipEvents = false } = {}) {
  const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(config.selectId));
  if (!selectEl) return;
  const option = config.options.find(opt => opt.pn === pn);
  const fieldEntries = Object.entries(config.fieldMap);
  if (!option) {
    fieldEntries.forEach(([inputId]) => {
      const inputEl = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));
      if (!inputEl) return;
      if (inputEl.dataset.componentSelect === config.selectId) {
        delete inputEl.dataset.componentSelect;
        delete inputEl.dataset.componentPn;
      }
    });
    return;
  }

  fieldEntries.forEach(([inputId, optionKey]) => {
    const inputEl = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));
    if (!inputEl) return;
    const value = option[optionKey];
    if (value == null) return;
    inputEl.dataset.componentSelect = config.selectId;
    inputEl.dataset.componentPn = option.pn;
    inputEl.dataset.componentSuppress = '1';
    inputEl.value = String(value);
    if (!skipEvents) {
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    delete inputEl.dataset.componentSuppress;
  });
}

export function setupComponentSelectors() {
  SELECT_CONFIGS.forEach(config => {
    const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(config.selectId));
    if (!selectEl) return;
    const initialValue = selectEl.value;

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
      applySelection(config, selectEl.value, { skipEvents: true });
    }
  });
}
