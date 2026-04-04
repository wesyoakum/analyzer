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
  h_hmot_cc_min:        'displacement_cc',
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

// ---- Shared sync: switch an entire group to a new unit ----

/** @type {((groupName: string, newUnit: string) => void) | null} */
let _onGroupChange = null;

function switchGroup(groupName, newUnit, triggerSelect) {
  const group = UNIT_GROUPS[groupName];
  if (!group || !group.units[newUnit]) return;

  // Sync all input field selectors in this group
  for (const [fieldId, gn] of Object.entries(FIELD_UNITS)) {
    if (gn !== groupName) continue;
    const sel = document.getElementById(getUnitSelectId(fieldId));
    if (!sel || sel === triggerSelect) continue;
    if (sel.value === newUnit) continue;

    const oldUnit = sel.dataset.prevUnit || sel.value;
    const oldFactor = getFactor(groupName, oldUnit);
    const newFactor = getFactor(groupName, newUnit);

    sel.value = newUnit;
    sel.dataset.prevUnit = newUnit;
    convertInputValue(fieldId, oldFactor, newFactor);
  }

  // Sync all output header selectors in this group
  document.querySelectorAll('select.th-unit-select').forEach(sel => {
    if (sel === triggerSelect) return;
    if (sel.dataset.unitGroup !== groupName) return;
    sel.value = newUnit;
  });

  if (typeof _onGroupChange === 'function') {
    _onGroupChange(groupName, newUnit);
  }
}

/**
 * Create a th-unit-select dropdown for a given unit group.
 * Used by the input summary on the sheet to mirror sidebar unit selectors.
 * Returns null if the group doesn't exist or has fewer than 2 units.
 */
export function createGroupSelector(groupName) {
  const group = UNIT_GROUPS[groupName];
  if (!group) return null;
  const unitKeys = Object.keys(group.units);
  if (unitKeys.length < 2) return null;

  const select = document.createElement('select');
  select.className = 'th-unit-select';
  select.dataset.unitGroup = groupName;

  const currentUnit = getGroupUnit(groupName);

  for (const [key, def] of Object.entries(group.units)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = def.label;
    if (key === currentUnit) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const newUnit = select.value;
    for (const [fieldId, gn] of Object.entries(FIELD_UNITS)) {
      if (gn !== groupName) continue;
      const inputSel = document.getElementById(getUnitSelectId(fieldId));
      if (inputSel && inputSel.value !== newUnit) {
        const oldUnit = inputSel.dataset.prevUnit || inputSel.value;
        const oldFactor = getFactor(groupName, oldUnit);
        const newFactor = getFactor(groupName, newUnit);
        inputSel.value = newUnit;
        inputSel.dataset.prevUnit = newUnit;
        convertInputValue(fieldId, oldFactor, newFactor);
      }
    }
    switchGroup(groupName, newUnit, select);
  });

  return select;
}

// ---- Initialize output header unit selectors ----

export function initOutputHeaderSelectors() {
  if (!isBrowser) return;
  document.querySelectorAll('[data-unit-group] .th-unit').forEach(span => {
    const parent = span.closest('[data-unit-group]');
    const groupName = parent.getAttribute('data-unit-group');
    const prefix = parent.getAttribute('data-unit-prefix') || '';
    if (!groupName) return;

    const group = UNIT_GROUPS[groupName];
    if (!group) return;
    const unitKeys = Object.keys(group.units);
    if (unitKeys.length < 2) return;

    const select = document.createElement('select');
    select.className = 'th-unit-select';
    select.dataset.unitGroup = groupName;
    select.dataset.unitPrefix = prefix;
    select.setAttribute('aria-label', `Unit for ${parent.getAttribute('title') || groupName}`);

    for (const [key, def] of Object.entries(group.units)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = prefix + def.label;
      if (key === group.internal) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      const newUnit = select.value;
      // Sync the triggering input field selector (so the group picks it up)
      // Find any input selector in this group to update prevUnit
      for (const [fieldId, gn] of Object.entries(FIELD_UNITS)) {
        if (gn !== groupName) continue;
        const inputSel = document.getElementById(getUnitSelectId(fieldId));
        if (inputSel && inputSel.value !== newUnit) {
          const oldUnit = inputSel.dataset.prevUnit || inputSel.value;
          const oldFactor = getFactor(groupName, oldUnit);
          const newFactor = getFactor(groupName, newUnit);
          inputSel.value = newUnit;
          inputSel.dataset.prevUnit = newUnit;
          convertInputValue(fieldId, oldFactor, newFactor);
        }
      }
      switchGroup(groupName, newUnit, select);
    });

    span.replaceWith(select);
  });
}

export function updateOutputHeaders() {
  if (!isBrowser) return;
  // Update all output header selects to match current group unit
  document.querySelectorAll('select.th-unit-select').forEach(select => {
    const groupName = select.dataset.unitGroup;
    if (groupName) {
      const currentUnit = getGroupUnit(groupName);
      if (currentUnit && select.value !== currentUnit) {
        select.value = currentUnit;
      }
    }
  });
}

// ---- Initialize unit selector dropdowns on input fields ----

export function initUnitSelectors(onGroupChange) {
  if (!isBrowser) return;
  _onGroupChange = onGroupChange;

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
    if (unitKeys.length < 2) continue;

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

    select.dataset.prevUnit = group.internal;

    unitCell.textContent = '';
    unitCell.appendChild(select);

    select.addEventListener('change', () => {
      const newUnit = select.value;
      const oldUnit = select.dataset.prevUnit;
      select.dataset.prevUnit = newUnit;
      if (oldUnit === newUnit) return;

      convertInputValue(fieldId, getFactor(groupName, oldUnit), getFactor(groupName, newUnit));
      switchGroup(groupName, newUnit, select);
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
  // Also sync output header selects
  updateOutputHeaders();
}

function convertInputValue(fieldId, oldFactor, newFactor) {
  const el = document.getElementById(fieldId);
  if (!el || el.value === '' || el.value == null) return;
  const oldValue = parseFloat(el.value.replace(',', '.'));
  if (!Number.isFinite(oldValue)) return;
  const converted = oldValue * newFactor / oldFactor;
  el.value = +converted.toPrecision(6);
}
