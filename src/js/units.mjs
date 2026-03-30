// ===== units.mjs — unit conversion system for imperial/metric toggle =====

// ---- Unit group definitions ----
// factor: multiply internal value by this to get display value

export const UNIT_GROUPS = {
  force_kgf: {
    internal: 'kgf',
    units: {
      kgf: { label: 'kgf', factor: 1 },
      lbf: { label: 'lbf', factor: 2.20462 },
    }
  },
  mass_kg: {
    internal: 'kg',
    units: {
      kg: { label: 'kg', factor: 1 },
      lb: { label: 'lb', factor: 2.20462 },
    }
  },
  length_m: {
    internal: 'm',
    units: {
      m:  { label: 'm',  factor: 1 },
      ft: { label: 'ft', factor: 3.28084 },
    }
  },
  length_mm: {
    internal: 'mm',
    units: {
      mm: { label: 'mm', factor: 1 },
      in: { label: 'in', factor: 1 / 25.4 },
    }
  },
  length_in: {
    internal: 'in',
    units: {
      in: { label: 'in', factor: 1 },
      mm: { label: 'mm', factor: 25.4 },
    }
  },
  speed_mpm: {
    internal: 'm/min',
    units: {
      'm/min':  { label: 'm/min',  factor: 1 },
      'ft/min': { label: 'ft/min', factor: 3.28084 },
    }
  },
  power_hp: {
    internal: 'hp',
    units: {
      hp: { label: 'hp', factor: 1 },
      kW: { label: 'kW', factor: 0.7457 },
    }
  },
  torque_Nm: {
    internal: 'N·m',
    units: {
      'N·m':    { label: 'N·m',    factor: 1 },
      'ft·lbf': { label: 'ft·lbf', factor: 0.737562 },
    }
  },
  pressure_psi: {
    internal: 'psi',
    units: {
      psi: { label: 'psi', factor: 1 },
      bar: { label: 'bar', factor: 0.0689476 },
    }
  },
  linear_density_kgpm: {
    internal: 'kg/m',
    units: {
      'kg/m':  { label: 'kg/m',  factor: 1 },
      'lb/ft': { label: 'lb/ft', factor: 0.671969 },
    }
  },
  displacement_cc: {
    internal: 'cc/rev',
    units: {
      'cc/rev':   { label: 'cc/rev',   factor: 1 },
      'in³/rev':  { label: 'in³/rev',  factor: 0.0610237 },
    }
  },
};

// ---- Input field → unit group mapping ----
export const FIELD_UNITS = {
  // Design
  rated_swl_kgf:        'force_kgf',
  rated_speed_mpm:      'speed_mpm',
  // Cable
  c_mm:                 'length_mm',
  cable_len_m:          'length_m',
  depth_m:              'length_m',
  dead_m:               'length_m',
  c_w_kgpm:             'linear_density_kgpm',
  mbl_kgf:              'force_kgf',
  // Drum
  core_in:              'length_in',
  flange_dia_in:        'length_in',
  ftf_in:               'length_in',
  lebus_in:             'length_in',
  // Payload
  payload_air_kg:       'mass_kg',
  payload_kg:           'mass_kg',
  tms_air_kg:           'mass_kg',
  vehicle_air_kg:       'mass_kg',
  additional_air_kg:    'mass_kg',
  tms_water_kg:         'mass_kg',
  vehicle_water_kg:     'mass_kg',
  additional_water_kg:  'mass_kg',
  // Drivetrain
  gearbox_max_torque_Nm: 'torque_Nm',
  // Electric
  motor_hp:             'power_hp',
  motor_tmax:           'torque_Nm',
  // Hydraulic
  h_hmot_cc:            'displacement_cc',
  h_emotor_hp:          'power_hp',
  h_pump_cc:            'displacement_cc',
  h_max_psi:            'pressure_psi',
};

// Output spans → unit group
export const OUTPUT_FIELD_UNITS = {
  system_min_hp:          'power_hp',
  max_length_strength_m:  'length_m',
};

// ---- Unit state (reads directly from DOM for always-in-sync behavior) ----

const isBrowser = typeof document !== 'undefined';

function getUnitSelectId(fieldId) {
  return `__unit_${fieldId}`;
}

export function getFieldUnit(fieldId) {
  if (isBrowser) {
    const selectEl = document.getElementById(getUnitSelectId(fieldId));
    if (selectEl) return selectEl.value;
  }
  const groupName = FIELD_UNITS[fieldId] || OUTPUT_FIELD_UNITS[fieldId];
  if (!groupName) return null;
  // For output-only fields, look up the group's current unit from any input field in the same group
  return getGroupUnit(groupName);
}

export function getGroupUnit(groupName) {
  const group = UNIT_GROUPS[groupName];
  if (!group) return null;
  if (isBrowser) {
    for (const [fieldId, gn] of Object.entries(FIELD_UNITS)) {
      if (gn === groupName) {
        const selectEl = document.getElementById(getUnitSelectId(fieldId));
        if (selectEl) return selectEl.value;
      }
    }
  }
  return group.internal;
}

function getFactor(groupName, unitKey) {
  const group = UNIT_GROUPS[groupName];
  if (!group) return 1;
  return group.units[unitKey]?.factor ?? 1;
}

// ---- Conversion functions ----

/** Convert a display-unit value to internal units for a given input field */
export function toInternal(fieldId, displayValue) {
  if (!Number.isFinite(displayValue)) return displayValue;
  const groupName = FIELD_UNITS[fieldId];
  if (!groupName) return displayValue;
  const unitKey = getFieldUnit(fieldId);
  const factor = getFactor(groupName, unitKey);
  return displayValue / factor;
}

/** Convert an internal value to display units for a given field */
export function fromInternal(fieldId, internalValue) {
  if (!Number.isFinite(internalValue)) return internalValue;
  const groupName = FIELD_UNITS[fieldId] || OUTPUT_FIELD_UNITS[fieldId];
  if (!groupName) return internalValue;
  const unitKey = getFieldUnit(fieldId);
  const factor = getFactor(groupName, unitKey);
  return internalValue * factor;
}

/** Convert an internal value to display units for a given unit group */
export function fromInternalForGroup(groupName, internalValue) {
  if (!Number.isFinite(internalValue)) return internalValue;
  const unitKey = getGroupUnit(groupName);
  const factor = getFactor(groupName, unitKey);
  return internalValue * factor;
}

/** Get the display label for the currently selected unit in a group */
export function getGroupLabel(groupName) {
  const unitKey = getGroupUnit(groupName);
  const group = UNIT_GROUPS[groupName];
  return group?.units[unitKey]?.label ?? unitKey ?? '';
}

// ---- Update output table header unit labels ----

export function updateOutputHeaders() {
  if (!isBrowser) return;
  document.querySelectorAll('[data-unit-group] .th-unit').forEach(span => {
    const parent = span.closest('[data-unit-group]');
    const groupName = parent.getAttribute('data-unit-group');
    const prefix = parent.getAttribute('data-unit-prefix') || '';
    if (groupName) {
      span.textContent = prefix + getGroupLabel(groupName);
    }
  });
}

// ---- Initialize unit selector dropdowns on input fields ----

export function initUnitSelectors(onGroupChange) {
  if (!isBrowser) return;
  for (const [fieldId, groupName] of Object.entries(FIELD_UNITS)) {
    const inputEl = document.getElementById(fieldId);
    if (!inputEl) continue;
    const tr = inputEl.closest('tr');
    if (!tr) continue;
    const unitCell = tr.querySelector('td.units');
    if (!unitCell) continue;

    const group = UNIT_GROUPS[groupName];
    if (!group) continue;
    const unitKeys = Object.keys(group.units);
    if (unitKeys.length < 2) {
      // Only one unit, no need for a selector
      continue;
    }

    const select = document.createElement('select');
    select.id = getUnitSelectId(fieldId);
    select.className = 'unit-select';
    select.setAttribute('aria-label', `Unit for ${fieldId}`);

    for (const [key, def] of Object.entries(group.units)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = def.label;
      if (key === group.internal) opt.selected = true;
      select.appendChild(opt);
    }

    // Track previous unit for value conversion on change
    select.dataset.prevUnit = group.internal;

    unitCell.textContent = '';
    unitCell.appendChild(select);

    select.addEventListener('change', () => {
      const newUnit = select.value;
      const oldUnit = select.dataset.prevUnit;
      select.dataset.prevUnit = newUnit;

      if (oldUnit === newUnit) return;

      const oldFactor = getFactor(groupName, oldUnit);
      const newFactor = getFactor(groupName, newUnit);

      // Convert this field's value
      convertInputValue(fieldId, oldFactor, newFactor);

      // Sync all other fields in the same group to the new unit
      for (const [otherFieldId, otherGroup] of Object.entries(FIELD_UNITS)) {
        if (otherGroup !== groupName || otherFieldId === fieldId) continue;
        const otherSelect = document.getElementById(getUnitSelectId(otherFieldId));
        if (!otherSelect || otherSelect.value === newUnit) continue;

        const otherOldUnit = otherSelect.dataset.prevUnit || otherSelect.value;
        const otherOldFactor = getFactor(groupName, otherOldUnit);
        const otherNewFactor = getFactor(groupName, newUnit);

        otherSelect.value = newUnit;
        otherSelect.dataset.prevUnit = newUnit;
        convertInputValue(otherFieldId, otherOldFactor, otherNewFactor);
      }

      updateOutputHeaders();

      if (typeof onGroupChange === 'function') {
        onGroupChange(groupName, newUnit);
      }
    });
  }
}

/** Sync prevUnit data attributes after persistence restores select values */
export function syncPrevUnits() {
  if (!isBrowser) return;
  for (const [fieldId] of Object.entries(FIELD_UNITS)) {
    const select = document.getElementById(getUnitSelectId(fieldId));
    if (select) {
      select.dataset.prevUnit = select.value;
    }
  }
}

function convertInputValue(fieldId, oldFactor, newFactor) {
  const el = document.getElementById(fieldId);
  if (!el || el.value === '' || el.value == null) return;
  const oldValue = parseFloat(el.value.replace(',', '.'));
  if (!Number.isFinite(oldValue)) return;
  const converted = oldValue * newFactor / oldFactor;
  el.value = +converted.toPrecision(6);
}
