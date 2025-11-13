// ===== main.mjs app bootstrap, compute, render, plots =====

import {
  q, read,
  G, W_PER_HP, PSI_TO_PA, CC_PER_GAL, M_PER_IN,
  tension_kgf, elec_available_tension_kgf,
  gpm_from_cc_rev_and_rpm, rpm_from_gpm_and_disp,
  psi_from_torque_and_disp_Nm_cc, torque_per_motor_from_pressure_Pa,
  line_speed_mpm_from_motor_rpm, hp_from_psi_and_gpm,
  TENSION_SAFETY_FACTOR
} from './utils.mjs';

import { setupInputPersistence } from './persist-inputs.mjs';

import { calcLayers } from './layer-engine.mjs';

import {
  rowsToElectricLayer, projectElectricWraps, renderElectricTables
} from './electric.mjs';

import {
  rowsToHydraulicLayer, projectHydraulicWraps, renderHydraulicTables
} from './hydraulic.mjs';

import { drawWaveContours, drawWaveHeightContours } from './plots/wave-contours.mjs';
import { drawDepthProfiles } from './plots/depth-profiles.mjs';
import { drawHydraulicRpmTorque } from './plots/rpm-torque.mjs';
import { setupComponentSelectors } from './component-selectors.mjs';
import { renderDrumVisualization, clearDrumVisualization } from './drum-visual.mjs';
import { renderLatexFragments } from './katex-renderer.mjs';

// ---- App state for plots/tables ----
let lastElLayer = [], lastElWraps = [];
let lastHyLayer = [], lastHyWraps = [];
/** @type {{ rows: any, summary: any, cfg: any, meta: any } | null} */
let lastDrumState = null;

const CSV_BUTTON_SPECS = {
  csv_el_layer: {
    filename: () => 'electric-layer.csv',
    columns: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'max_tension_theoretical_kgf',
      'max_tension_required_kgf', 'tau_avail_kNm', 'max_motor_torque_Nm',
      'motor_rpm_at_start', 'line_speed_at_start_mpm',
      'tension_theoretical_start_kgf', 'tension_required_start_kgf', 'avail_tension_kgf'
    ],
    header: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'max_tension_theoretical_kgf',
      'max_tension_required_kgf', 'tau_avail_kNm', 'max_motor_torque_Nm',
      'motor_rpm_at_start', 'line_speed_at_start_mpm',
      'tension_theoretical_start_kgf', 'tension_required_start_kgf', 'avail_tension_kgf'
    ],
    getRows: () => lastElLayer
  },
  csv_el_wraps: {
    filename: () => 'electric-wraps.csv',
    columns: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'tau_avail_kNm', 'motor_torque_Nm', 'motor_rpm',
      'line_speed_mpm', 'avail_tension_kgf'
    ],
    header: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'tau_avail_kNm', 'motor_torque_Nm', 'motor_rpm',
      'line_speed_mpm', 'avail_tension_kgf'
    ],
    getRows: () => lastElWraps
  },
  csv_hy_layer: {
    filename: () => 'hydraulic-layer.csv',
    columns: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'hyd_P_required_psi',
      'hyd_speed_power_mpm', 'hyd_speed_flow_mpm', 'hyd_speed_available_mpm',
      'hyd_hp_req', 'hyd_hp_sys', 'hyd_tau_avail_kNm',
      'hyd_tension_theoretical_start_kgf', 'hyd_tension_required_start_kgf',
      'hyd_avail_tension_kgf'
    ],
    header: [
      'layer_no', 'layer_dia_in', 'pre_on_drum_m', 'pre_deployed_m',
      'post_on_drum_m', 'post_deployed_m', 'hyd_P_required_psi',
      'hyd_speed_power_mpm', 'hyd_speed_flow_mpm', 'hyd_speed_available_mpm',
      'hyd_hp_req', 'hyd_hp_sys', 'hyd_tau_avail_kNm',
      'hyd_tension_theoretical_start_kgf', 'hyd_tension_required_start_kgf',
      'hyd_avail_tension_kgf'
    ],
    getRows: () => lastHyLayer
  },
  csv_hy_wraps: {
    filename: () => 'hydraulic-wraps.csv',
    columns: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'hyd_P_required_psi', 'hyd_speed_power_mpm',
      'hyd_speed_flow_mpm', 'hyd_speed_available_mpm', 'hyd_hp_req',
      'hyd_hp_sys', 'hyd_tau_avail_kNm', 'hyd_avail_tension_kgf'
    ],
    header: [
      'wrap_no', 'layer_no', 'layer_dia_in', 'wrap_len_in', 'pre_spooled_len_m',
      'spooled_len_m', 'deployed_len_m', 'tension_theoretical_kgf',
      'tension_required_kgf', 'hyd_P_required_psi', 'hyd_speed_power_mpm',
      'hyd_speed_flow_mpm', 'hyd_speed_available_mpm', 'hyd_hp_req',
      'hyd_hp_sys', 'hyd_tau_avail_kNm', 'hyd_avail_tension_kgf'
    ],
    getRows: () => lastHyWraps
  }
};

const SYSTEM_TYPE_SELECT_ID = 'system_type_select';
const DEFAULT_SYSTEM_TYPE = 'electric';

// ---- Wire up events once DOM is ready ----
document.addEventListener('DOMContentLoaded', () => {
  setupInputPersistence();

  setupComponentSelectors();

  setupCollapsibleToggles();

  setupDriveModeControls();

  setupCsvDownloads();

  setupPlotResizeToggles();

  setupManualRefreshControls();

  setupAutoRecompute();

  updateBuildIndicator();

  setupTabs();

  renderDocumentMath();

  document.querySelectorAll('.param-label').forEach(label => {
    const code = label.dataset.code;
    if (code) {
      label.setAttribute('title', code);
    }
  });

  // Wave plot controls
  q('wave_scenario').addEventListener('change', () => redrawPlots());
  ['wave_tmin', 'wave_tmax', 'wave_vmin', 'wave_vmax', 'wave_hmin', 'wave_hmax']
    .forEach(id => q(id).addEventListener('change', () => redrawPlots()));

  // Depth plot controls
  ['depth_xmin', 'depth_xmax', 'depth_speed_ymin', 'depth_speed_ymax', 'depth_tension_ymin', 'depth_tension_ymax']
    .forEach(id => q(id).addEventListener('change', () => redrawPlots()));

  // Initial compute
  computeAll();
});

function renderDocumentMath() {
  if (typeof window.renderMathInElement === 'function') {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
  renderLatexFragments(document.body);
}

function updateBuildIndicator() {
  const indicator = /** @type {HTMLElement|null} */ (document.getElementById('build-info'));
  if (!indicator) return;

  const lastModified = new Date(document.lastModified);
  if (Number.isNaN(lastModified.getTime())) {
    indicator.textContent = `Updated ${document.lastModified}`;
    return;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  });

  indicator.textContent = `Updated ${formatter.format(lastModified)} UTC`;
}

function setupTabs() {
  /** @type {Array<{tab: HTMLElement, panel: HTMLElement}>} */
  const tabEntries = [];
  document.querySelectorAll('[role="tab"]').forEach(tabEl => {
    const controls = tabEl.getAttribute('aria-controls');
    const panel = controls ? /** @type {HTMLElement|null} */ (document.getElementById(controls)) : null;
    if (!panel) return;
    tabEntries.push({ tab: /** @type {HTMLElement} */ (tabEl), panel });
  });

  if (!tabEntries.length) return;

  /** @param {HTMLElement} el */
  const isDisabled = el => el.hasAttribute('disabled');

  const enabledTabs = () => tabEntries.map(entry => entry.tab).filter(tab => !isDisabled(tab));

  const activate = (nextTab, { setFocus = false } = {}) => {
    tabEntries.forEach(({ tab, panel }) => {
      const isActive = tab === nextTab;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;

      panel.classList.toggle('active', isActive);
      panel.toggleAttribute('hidden', !isActive);
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      panel.tabIndex = isActive ? 0 : -1;
    });

    if (setFocus) {
      nextTab.focus();
    }
  };

  const focusRelative = (currentTab, delta) => {
    const tabs = enabledTabs();
    if (!tabs.length) return;
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    activate(tabs[nextIndex], { setFocus: true });
  };

  const focusEdge = (first = true) => {
    const tabs = enabledTabs();
    if (!tabs.length) return;
    activate(first ? tabs[0] : tabs[tabs.length - 1], { setFocus: true });
  };

  tabEntries.forEach(({ tab }) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', evt => {
      switch (evt.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          evt.preventDefault();
          focusRelative(tab, -1);
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          evt.preventDefault();
          focusRelative(tab, 1);
          break;
        case 'Home':
          evt.preventDefault();
          focusEdge(true);
          break;
        case 'End':
          evt.preventDefault();
          focusEdge(false);
          break;
        default:
          break;
      }
    });
  });

  const initialTab = tabEntries
    .map(entry => entry.tab)
    .find(tab => tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true');

  activate(initialTab || tabEntries[0].tab);
}

function setupCsvDownloads() {
  Object.entries(CSV_BUTTON_SPECS).forEach(([id, spec]) => {
    const btn = q(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const rows = spec.getRows ? spec.getRows() : [];
      if (!rows || rows.length === 0) return;
      const csv = rowsToCsv(rows, spec.columns, spec.header);
      triggerCsvDownload(csv, spec.filename ? spec.filename() : `${id}.csv`);
    });
  });

  updateCsvButtonStates();
}

function updateCsvButtonStates() {
  Object.entries(CSV_BUTTON_SPECS).forEach(([id, spec]) => {
    const btn = q(id);
    if (!btn) return;
    const rows = spec.getRows ? spec.getRows() : [];
    btn.disabled = !(Array.isArray(rows) && rows.length > 0);
  });
}

function rowsToCsv(rows, columns, headerRow) {
  const header = (headerRow && headerRow.length ? headerRow : columns).map(csvEscapeCell).join(',');
  const dataLines = rows.map(row => columns.map(col => csvEscapeCell(row[col])).join(','));
  return [header, ...dataLines].join('\r\n');
}

function csvEscapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function triggerCsvDownload(csvText, filename) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function setupCollapsibleToggles() {
  let collapseIdCounter = 0;
  const configs = [
    { selector: '#component-catalog-card', headerSelector: '.section-title', defaultExpanded: false },
    { selector: '#sidebar-inputs .card[data-drive-scope]', headerSelector: '.section-title', defaultExpanded: true },
    { selector: '#sidebar-inputs .input-section', headerSelector: '.input-section__title', defaultExpanded: true },
    { selector: '#sidebar-inputs .input-subsection', headerSelector: '.input-subsection__title', defaultExpanded: true },
    { selector: '.plot-controls__group', headerSelector: '.plot-controls__group-title', defaultExpanded: false }
  ];

  configs.forEach(({ selector, headerSelector, defaultExpanded }) => {
    document.querySelectorAll(selector).forEach(container => {
      initCollapsibleContainer(container, headerSelector, defaultExpanded);
    });
  });

  /**
   * @param {Element} container
   * @param {string} headerSelector
   * @param {boolean} defaultExpanded
   */
  function initCollapsibleContainer(container, headerSelector, defaultExpanded) {
    if (!(container instanceof HTMLElement)) return;
    if (container.dataset.collapseInit === 'true') return;

    const headerEl = container.querySelector(headerSelector);
    if (!headerEl) return;

    // Remove leading whitespace before the header to avoid stray text nodes.
    let cursor = container.firstChild;
    while (cursor && cursor !== headerEl) {
      const nextCursor = cursor.nextSibling;
      if (cursor.nodeType === Node.TEXT_NODE && !(cursor.textContent || '').trim()) {
        container.removeChild(cursor);
      }
      cursor = nextCursor;
    }

    const body = document.createElement('div');
    body.classList.add('collapse-body');

    let node = headerEl.nextSibling;
    while (node) {
      const next = node.nextSibling;
      body.appendChild(node);
      node = next;
    }

    const headerWrapper = document.createElement('div');
    headerWrapper.classList.add('collapse-header');
    headerWrapper.appendChild(headerEl);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.classList.add('collapse-toggle');
    headerWrapper.appendChild(toggle);

    container.insertBefore(headerWrapper, container.firstChild);
    container.appendChild(body);
    container.dataset.collapseInit = 'true';

    if (!body.id) {
      collapseIdCounter += 1;
      body.id = `collapse-body-${collapseIdCounter}`;
    }
    toggle.setAttribute('aria-controls', body.id);

    let expanded = defaultExpanded;

    const applyState = (value) => {
      expanded = value;
      toggle.textContent = expanded ? '[-]' : '[+]';
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.setAttribute('aria-label', expanded ? 'Collapse section' : 'Expand section');
      body.hidden = !expanded;
      container.classList.toggle('is-collapsed', !expanded);
    };

    applyState(expanded);

    toggle.addEventListener('click', () => {
      applyState(!expanded);
    });
  }
}

function setupPlotResizeToggles() {
  const toggles = document.querySelectorAll('[data-plot-pair-toggle]');
  toggles.forEach(btn => {
    const pair = btn.closest('[data-plot-pair]');
    if (!pair) return;

    const setState = (expanded) => {
      pair.classList.toggle('is-expanded', expanded);
      btn.textContent = expanded ? '[-]' : '[+]';
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.setAttribute('aria-label', expanded ? 'Collapse plots to two columns' : 'Expand plots to full width');
    };

    setState(pair.classList.contains('is-expanded'));

    btn.addEventListener('click', () => {
      const next = !pair.classList.contains('is-expanded');
      setState(next);
    });
  });
}

function setupManualRefreshControls() {
  const plotButtons = document.querySelectorAll('[data-refresh-plots]');
  plotButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      redrawPlots();
    });
  });

  const drumButton = /** @type {HTMLButtonElement|null} */ (document.querySelector('[data-drum-refresh]'));
  if (drumButton) {
    drumButton.addEventListener('click', () => {
      if (lastDrumState) {
        const { rows, summary, cfg, meta } = lastDrumState;
        renderDrumVisualization(rows, summary, cfg, meta);
      } else {
        computeAll();
      }
    });
  }
}

function renderInputSummary() {
  const summaryRoot = /** @type {HTMLElement|null} */ (document.getElementById('input-summary'));
  const sourceRoot = /** @type {HTMLElement|null} */ (document.getElementById('sidebar-inputs'));
  if (!summaryRoot || !sourceRoot) return;

  const cards = Array.from(sourceRoot.querySelectorAll('[data-summary-card]'))
    .map(el => /** @type {HTMLElement} */ (el))
    .filter(card => !card.classList.contains('is-hidden'));

  const frag = document.createDocumentFragment();

  cards.forEach(card => {
    const summaryCard = document.createElement('section');
    summaryCard.classList.add('card', 'summary-card');

    const cardTitle = getNodeText(card.querySelector('.section-title'));
    if (cardTitle) {
      const heading = document.createElement('h2');
      heading.classList.add('section-title', 'summary-card__title');
      heading.textContent = cardTitle;
      summaryCard.appendChild(heading);
    }

    const sectionsContainer = document.createElement('div');
    sectionsContainer.classList.add('input-summary__sections');

    const inputSections = Array.from(card.querySelectorAll('.input-section'))
      .map(el => /** @type {HTMLElement} */ (el))
      .filter(section => section.closest('[data-summary-card]') === card && !section.classList.contains('is-hidden'));

    if (inputSections.length) {
      inputSections.forEach(section => {
        const sectionSummary = buildInputSectionSummary(section);
        if (sectionSummary) sectionsContainer.appendChild(sectionSummary);
      });
    } else {
      const plotGroups = Array.from(card.querySelectorAll('.plot-controls__group'))
        .map(el => /** @type {HTMLElement} */ (el))
        .filter(group => group.closest('[data-summary-card]') === card && !group.classList.contains('is-hidden'));

      if (plotGroups.length) {
        plotGroups.forEach(group => {
          const groupSummary = buildPlotGroupSummary(group);
          if (groupSummary) sectionsContainer.appendChild(groupSummary);
        });
      }
    }

    if (!sectionsContainer.children.length) {
      const tables = collectTables(card, table => table.closest('[data-summary-card]') === card);
      if (tables.length) {
        const fallbackSection = document.createElement('section');
        fallbackSection.classList.add('input-summary__section');
        tables.forEach(table => fallbackSection.appendChild(buildSummaryTable(table)));
        sectionsContainer.appendChild(fallbackSection);
      }
    }

    if (!sectionsContainer.children.length) return;

    summaryCard.appendChild(sectionsContainer);
    frag.appendChild(summaryCard);
  });

  summaryRoot.replaceChildren(frag);
}

/**
 * @param {HTMLElement} sectionEl
 */
function buildInputSectionSummary(sectionEl) {
  const summarySection = document.createElement('section');
  summarySection.classList.add('input-summary__section');

  const title = getNodeText(sectionEl.querySelector('.input-section__title'));
  if (title) {
    const heading = document.createElement('h3');
    heading.classList.add('input-summary__section-title');
    heading.textContent = title;
    summarySection.appendChild(heading);
  }

  collectTables(sectionEl, table => table.closest('.input-section') === sectionEl && !table.closest('.input-subsection'))
    .forEach(table => summarySection.appendChild(buildSummaryTable(table)));

  const subsections = Array.from(sectionEl.querySelectorAll('.input-subsection'))
    .map(el => /** @type {HTMLElement} */ (el))
    .filter(sub => sub.closest('.input-section') === sectionEl && !sub.classList.contains('is-hidden'));

  subsections.forEach(subsection => {
    const subsectionSummary = buildInputSubsectionSummary(subsection);
    if (subsectionSummary) summarySection.appendChild(subsectionSummary);
  });

  if (!summarySection.children.length) return null;
  return summarySection;
}

/**
 * @param {HTMLElement} subsectionEl
 */
function buildInputSubsectionSummary(subsectionEl) {
  const summarySubsection = document.createElement('section');
  summarySubsection.classList.add('input-summary__subsection');

  const title = getNodeText(subsectionEl.querySelector('.input-subsection__title'));
  if (title) {
    const heading = document.createElement('h4');
    heading.classList.add('input-summary__subsection-title');
    heading.textContent = title;
    summarySubsection.appendChild(heading);
  }

  collectTables(subsectionEl, table => table.closest('.input-subsection') === subsectionEl)
    .forEach(table => summarySubsection.appendChild(buildSummaryTable(table)));

  if (!summarySubsection.children.length) return null;
  return summarySubsection;
}

/**
 * @param {HTMLElement} groupEl
 */
function buildPlotGroupSummary(groupEl) {
  const summarySection = document.createElement('section');
  summarySection.classList.add('input-summary__section');

  const title = getNodeText(groupEl.querySelector('.plot-controls__group-title'));
  if (title) {
    const heading = document.createElement('h3');
    heading.classList.add('input-summary__section-title');
    heading.textContent = title;
    summarySection.appendChild(heading);
  }

  collectTables(groupEl, table => table.closest('.plot-controls__group') === groupEl)
    .forEach(table => summarySection.appendChild(buildSummaryTable(table)));

  if (!summarySection.children.length) return null;
  return summarySection;
}

/**
 * @param {HTMLElement} tableEl
 */
function buildSummaryTable(tableEl) {
  const summaryTable = document.createElement('table');
  summaryTable.classList.add('worksheet', 'worksheet--summary');

  const header = tableEl.tHead ? tableEl.tHead.cloneNode(true) : null;
  if (header instanceof HTMLTableSectionElement) {
    const headers = header.querySelectorAll('th');
    if (headers.length > 1) headers[1].textContent = 'Value';
    summaryTable.appendChild(header);
  }

  const body = document.createElement('tbody');

  Array.from(tableEl.tBodies).forEach(srcBody => {
    Array.from(srcBody.rows).forEach(row => {
      const summaryRow = document.createElement('tr');
      summaryRow.className = row.className;

      if (row.classList.contains('note') || row.cells.length === 1) {
        const srcCell = row.cells[0];
        const cell = document.createElement('td');
        cell.colSpan = srcCell.colSpan || row.cells.length || 1;
        cell.className = srcCell.className;
        cell.textContent = normalizeText(srcCell.textContent);
        summaryRow.appendChild(cell);
        body.appendChild(summaryRow);
        return;
      }

      const headerCell = row.querySelector('th');
      if (headerCell) {
        const clonedHeader = headerCell.cloneNode(true);
        summaryRow.appendChild(clonedHeader);
      }

      const valueCell = document.createElement('td');
      valueCell.classList.add('value');
      valueCell.textContent = extractSummaryValue(row.querySelector('td.value'));
      summaryRow.appendChild(valueCell);

      const unitsCell = row.querySelector('td.units');
      if (unitsCell) {
        const clonedUnits = unitsCell.cloneNode(true);
        clonedUnits.textContent = normalizeText(unitsCell.textContent);
        summaryRow.appendChild(clonedUnits);
      }

      body.appendChild(summaryRow);
    });
  });

  summaryTable.appendChild(body);
  return summaryTable;
}

/**
 * @param {HTMLElement} tableCell
 */
function extractSummaryValue(tableCell) {
  if (!tableCell) return '–';

  const formControl = tableCell.querySelector('input, select, textarea');
  if (formControl instanceof HTMLInputElement) {
    if (formControl.type === 'checkbox') {
      return formControl.checked ? 'Yes' : 'No';
    }
    if (formControl.type === 'radio') {
      return formControl.checked ? normalizeText(formControl.value) : '–';
    }
    return normalizeText(formControl.value);
  }

  if (formControl instanceof HTMLSelectElement) {
    if (formControl.multiple) {
      const selections = Array.from(formControl.selectedOptions).map(opt => normalizeText(opt.textContent));
      return selections.length ? selections.join(', ') : '–';
    }
    const option = formControl.selectedOptions[0];
    return option ? normalizeText(option.textContent) : '–';
  }

  if (formControl instanceof HTMLTextAreaElement) {
    return normalizeText(formControl.value);
  }

  const outputField = tableCell.querySelector('.output-field');
  if (outputField) {
    return normalizeText(outputField.textContent);
  }

  return normalizeText(tableCell.textContent);
}

/**
 * @param {Element|null} node
 */
function getNodeText(node) {
  if (!node) return '';
  return normalizeText(node.textContent);
}

/**
 * @param {Element} root
 * @param {(table: HTMLTableElement) => boolean} predicate
 */
function collectTables(root, predicate) {
  return Array.from(root.querySelectorAll('table.worksheet'))
    .map(el => /** @type {HTMLTableElement} */ (el))
    .filter(table => predicate(table));
}

/**
 * @param {string|null} text
 */
function normalizeText(text) {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim();
  return trimmed || '–';
}

function setupAutoRecompute() {
  const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
  if (!inputs.length) return;

  const handler = () => computeAll();

  inputs.forEach(el => {
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', handler);
      return;
    }

    if (el.tagName === 'INPUT') {
      const type = el.type;
      if (type === 'checkbox' || type === 'radio' || type === 'range' || type === 'color') {
        el.addEventListener('change', handler);
        return;
      }
    }

    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });
}

function updateMinimumSystemHp(ratedSpeedMpm, ratedSwlKgf, efficiency) {
  const output = /** @type {HTMLElement|null} */ (document.getElementById('system_min_hp'));
  if (!output) return;

  const validSpeed = Number.isFinite(ratedSpeedMpm) && ratedSpeedMpm > 0;
  const validSwl = Number.isFinite(ratedSwlKgf) && ratedSwlKgf > 0;

  if (!validSpeed || !validSwl) {
    output.textContent = '–';
    return;
  }

  const eff = Number.isFinite(efficiency) && efficiency > 0 ? efficiency : 1;
  const force_N = ratedSwlKgf * G;
  const speed_mps = ratedSpeedMpm / 60;
  const base_power_W = force_N * speed_mps;
  const base_hp = base_power_W / W_PER_HP;
  const hp_with_eff = base_hp / eff;
  const min_hp = hp_with_eff * 1.2;

  output.textContent = Number.isFinite(min_hp) ? min_hp.toFixed(1) : '–';
}

function clearMinimumSystemHp() {
  const output = /** @type {HTMLElement|null} */ (document.getElementById('system_min_hp'));
  if (output) output.textContent = '–';
}

function setupDriveModeControls() {
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById(SYSTEM_TYPE_SELECT_ID));
  if (select) {
    const handler = () => {
      syncDriveModeVisibility();
    };
    select.addEventListener('change', handler);
    select.addEventListener('input', handler);
  }

  syncDriveModeVisibility();
}

function driveModeEnabled(mode) {
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById(SYSTEM_TYPE_SELECT_ID));
  const rawValue = (select && select.value) ? select.value : DEFAULT_SYSTEM_TYPE;
  const normalized = rawValue === 'electric' || rawValue === 'hydraulic' ? rawValue : DEFAULT_SYSTEM_TYPE;
  return normalized === mode;
}

function getActiveScenario() {
  if (driveModeEnabled('electric')) return 'electric';
  if (driveModeEnabled('hydraulic')) return 'hydraulic';
  return DEFAULT_SYSTEM_TYPE;
}

function syncDriveModeVisibility() {
  const electricEnabled = driveModeEnabled('electric');
  const hydraulicEnabled = driveModeEnabled('hydraulic');

  document.querySelectorAll('[data-drive-scope]').forEach(el => {
    const scope = el.getAttribute('data-drive-scope');
    if (scope === 'electric') {
      el.classList.toggle('is-hidden', !electricEnabled);
    } else if (scope === 'hydraulic') {
      el.classList.toggle('is-hidden', !hydraulicEnabled);
    }
  });

  updateScenarioOptions('wave_scenario', electricEnabled, hydraulicEnabled);
}

function updateScenarioOptions(selectId, electricEnabled, hydraulicEnabled) {
  const selectEl = /** @type {HTMLSelectElement|null} */ (document.getElementById(selectId));
  if (!selectEl) return;

  let needsChange = false;
  Array.from(selectEl.options).forEach(opt => {
    if (opt.value === 'electric') {
      const disabled = !electricEnabled;
      if (opt.disabled !== disabled) opt.disabled = disabled;
      if (opt.hidden !== disabled) opt.hidden = disabled;
      if (disabled && opt.selected) needsChange = true;
    } else if (opt.value === 'hydraulic') {
      const disabled = !hydraulicEnabled;
      if (opt.disabled !== disabled) opt.disabled = disabled;
      if (opt.hidden !== disabled) opt.hidden = disabled;
      if (disabled && opt.selected) needsChange = true;
    }
  });

  if (needsChange) {
    if (electricEnabled) {
      selectEl.value = 'electric';
    } else if (hydraulicEnabled) {
      selectEl.value = 'hydraulic';
    } else {
      const first = Array.from(selectEl.options).find(opt => !opt.disabled);
      if (first) selectEl.value = first.value;
    }
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// ---- Core compute + render ----
function computeAll() {
  const errBox = /** @type {HTMLElement|null} */ (document.getElementById('err'));
  if (errBox) errBox.textContent = '';

  try {
    // Geometry & load inputs
    const wraps_override_input = read('wraps_override');
    const wraps_per_layer_override = (
      Number.isFinite(wraps_override_input) && wraps_override_input > 0
    ) ? wraps_override_input : undefined;

    const cfg = {
      cable_dia_mm: read('c_mm'),
      operating_depth_m: read('depth_m'),
      dead_end_m: read('dead_m'),
      core_dia_in: read('core_in'),
      flange_dia_in: read('flange_dia_in'),
      flange_to_flange_in: read('ftf_in'),
      lebus_thk_in: read('lebus_in'),
      packing_factor: read('pack'),
      wraps_per_layer_override
    };
    const payload_kg = read('payload_kg');
    const cable_w_kgpm = read('c_w_kgpm');

    const rated_speed_mpm = read('rated_speed_mpm');
    const rated_swl_kgf = read('rated_swl_kgf');
    const system_efficiency = read('system_efficiency');

    updateMinimumSystemHp(rated_speed_mpm, rated_swl_kgf, system_efficiency);

    const positiveOr = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);

    // Shared drivetrain
    const gr1 = positiveOr(read('gr1'), 1);
    const gr2 = positiveOr(read('gr2'), 1);
    const motors = positiveOr(read('motors'), 1);
    const denom_mech = gr1 * gr2 * motors;
    const gear_product = Math.max(gr1, 1e-9) * Math.max(gr2, 1e-9);

    const electricEnabled = driveModeEnabled('electric');
    const hydraulicEnabled = driveModeEnabled('hydraulic');

    // Electric inputs
    const motor_max_rpm = read('motor_max_rpm');
    const motor_hp = positiveOr(read('motor_hp'), 0);
    const motor_eff = positiveOr(read('motor_eff'), 1);
    const motor_tmax = read('motor_tmax');
    const P_per_motor_W = motor_hp * motor_eff * W_PER_HP;

    // Hydraulic inputs
    const h_strings = positiveOr(read('h_pump_strings'), 0);
    const h_emotor_hp = positiveOr(read('h_emotor_hp'), 0);
    const h_emotor_eff = positiveOr(read('h_emotor_eff'), 0); // electro-hydraulic efficiency
    const h_emotor_rpm = positiveOr(read('h_emotor_rpm'), 0);
    const h_pump_cc = positiveOr(read('h_pump_cc'), 0);
    const h_max_psi = positiveOr(read('h_max_psi'), 0);
    const h_hmot_cc = positiveOr(read('h_hmot_cc'), 0);
    const h_hmot_rpm_cap = positiveOr(read('h_hmot_rpm_max'), Infinity);

    // Usable hydraulic hp & flow from pump strings
    const hp_str_usable = h_emotor_hp * h_emotor_eff;
    const hp_tot_usable = hp_str_usable * h_strings;
    const q_str_gpm = gpm_from_cc_rev_and_rpm(h_pump_cc, h_emotor_rpm);
    const q_tot_gpm = q_str_gpm * h_strings;

    // Max-pressure torque per hydraulic motor and at drum (pressure-limited)
    const dP_Pa = h_max_psi * PSI_TO_PA;
    const torque_per_hmotor_maxP = torque_per_motor_from_pressure_Pa(dP_Pa, h_hmot_cc); // N·m per motor at max P
    const torque_at_drum_maxP_factor = Math.max(gr1, 1) * Math.max(gr2, 1) * Math.max(motors, 1);

    // Generate wraps from geometry
    const { rows, summary, meta } = calcLayers(cfg);

    const wrapsNoteEl = /** @type {HTMLTableCellElement|null} */ (document.getElementById('wraps_note'));
    if (wrapsNoteEl) {
      const calcWraps = meta && Number.isFinite(meta.wraps_per_layer_calc) ? meta.wraps_per_layer_calc : undefined;
      const display = (typeof calcWraps === 'number') ? calcWraps.toFixed(1) : '–';
      wrapsNoteEl.textContent = `Leave blank or set to 0 to use calculated wraps (always truncated to .0/.5). Auto-calculated wraps per layer: ${display}.`;
    }

    // Per-wrap calculations (electric + hydraulic)
    for (const r of rows) {
      // Base tension and torque at drum
      const theoretical_tension = tension_kgf(r.deployed_len_m, payload_kg, cable_w_kgpm);
      const required_tension = +(theoretical_tension * TENSION_SAFETY_FACTOR).toFixed(1);
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

      // ----- ELECTRIC per wrap -----
      if (electricEnabled) {
        const motorTorque_e = r.torque_Nm / (denom_mech || 1);
        r.motor_torque_Nm = +motorTorque_e.toFixed(2);

        // RPM limited by available power per motor and capped by motor max rpm
        let rpm_power_e = 0;
        if (P_per_motor_W > 0 && motorTorque_e > 0) {
          rpm_power_e = (P_per_motor_W / motorTorque_e) * 60 / (2 * Math.PI);
        } else if (P_per_motor_W > 0 && motorTorque_e === 0) {
          rpm_power_e = Number.POSITIVE_INFINITY;
        } else {
          rpm_power_e = 0;
        }
        const rpm_capped_e = Math.min(Number.isFinite(motor_max_rpm) ? motor_max_rpm : Infinity, rpm_power_e);
        r.motor_rpm = +((Number.isFinite(rpm_capped_e) ? rpm_capped_e : 0)).toFixed(1);

        // Line speed at drum
        r.line_speed_mpm = +line_speed_mpm_from_motor_rpm(r.motor_rpm, gr1, gr2, r.layer_dia_in).toFixed(2);

        // Available line tension from motor torque cap
        r.avail_tension_kgf = elec_available_tension_kgf(motor_tmax, gr1, gr2, motors, radius_m);
      } else {
        r.motor_torque_Nm = 0;
        r.motor_rpm = 0;
        r.line_speed_mpm = 0;
        r.avail_tension_kgf = 0;
      }

      // ----- HYDRAULIC per wrap -----
      if (hydraulicEnabled) {
        // Pressure-limited drum torque and available tension
        const drum_T_pressure_max = torque_per_hmotor_maxP * torque_at_drum_maxP_factor; // N·m at drum
        r.hyd_drum_torque_maxP_Nm = +drum_T_pressure_max.toFixed(2);
        const hyd_avail_tension_N = drum_T_pressure_max / Math.max(radius_m, 1e-12);
        r.hyd_avail_tension_kgf = +(hyd_avail_tension_N / G).toFixed(1);

        const D_m = r.layer_dia_in * M_PER_IN;
        const safe_drum_circumference = Math.max(Math.PI * Math.max(D_m, 1e-9), 1e-9);

        // Pressure required for current torque (per motor)
        const torque_per_hmotor = torque_per_hmotor_required;
        let P_req_psi = psi_from_torque_and_disp_Nm_cc(torque_per_hmotor, h_hmot_cc);
        if (!Number.isFinite(P_req_psi) || P_req_psi < 0) P_req_psi = 0;

        // Flow-limited speed
        const rpm_flow_per_motor = Math.min(
          h_hmot_rpm_cap,
          rpm_from_gpm_and_disp(q_tot_gpm / Math.max(motors, 1), h_hmot_cc)
        );
        const speed_flow_mpm = line_speed_mpm_from_motor_rpm(rpm_flow_per_motor, gr1, gr2, r.layer_dia_in);
        const rpm_flow_clean = Number.isFinite(rpm_flow_per_motor) && rpm_flow_per_motor > 0 ? rpm_flow_per_motor : 0;
        const rpm_flow_drum = rpm_flow_clean / gear_product_safe;

        // Power-limited speed (cap pressure at max if P_req exceeds max)
        const P_power_psi = (P_req_psi > 0) ? Math.min(P_req_psi, h_max_psi) : 0;
        const hp_elec_in_total = h_emotor_hp * h_strings;
        const eff_total = h_emotor_eff;

        let speed_power_mpm = 0;
        if (hp_elec_in_total > 0 && eff_total > 0 && theoretical_tension > 0) {
          const tension_theoretical_N = theoretical_tension * G;
          if (tension_theoretical_N > 0) {
            const power_available_W = hp_elec_in_total * eff_total * W_PER_HP;
            const speed_power_mps = power_available_W / tension_theoretical_N;
            speed_power_mpm = speed_power_mps * 60;
          }
        }
        if (!Number.isFinite(speed_power_mpm) || speed_power_mpm < 0) speed_power_mpm = 0;
        const rpm_power_drum = Number.isFinite(speed_power_mpm) && speed_power_mpm > 0
          ? speed_power_mpm / safe_drum_circumference
          : Number.isFinite(speed_power_mpm) && speed_power_mpm === 0
            ? 0
            : NaN;

        let speed_avail_mpm = Math.min(speed_power_mpm, speed_flow_mpm);
        if (!Number.isFinite(speed_avail_mpm) || speed_avail_mpm < 0) speed_avail_mpm = 0;
        const rpm_available_drum = Number.isFinite(speed_avail_mpm)
          ? speed_avail_mpm / safe_drum_circumference
          : NaN;

        let hp_used_at_available = 0;
        if (speed_avail_mpm > 0 && P_power_psi > 0) {
          // Power used at the actual available speed
          const drum_rpm_needed = speed_avail_mpm / Math.max(Math.PI * Math.max(D_m, 1e-9), 1e-9);
          const motor_rpm_needed = drum_rpm_needed * (Math.max(gr1, 1) * Math.max(gr2, 1));
          const gpm_per_motor_needed = (motor_rpm_needed * h_hmot_cc) / CC_PER_GAL;
          const gpm_total_needed = Math.max(motors, 1) * gpm_per_motor_needed;
          const gpm_used = Math.min(gpm_total_needed, q_tot_gpm);
          hp_used_at_available = hp_from_psi_and_gpm(P_power_psi, gpm_used);
          if (hp_used_at_available > hp_tot_usable) hp_used_at_available = hp_tot_usable;
        }

        r.hyd_P_required_psi = Math.round(P_req_psi);
        r.hyd_speed_power_mpm = +speed_power_mpm.toFixed(2);
        r.hyd_speed_flow_mpm = +speed_flow_mpm.toFixed(2);
        r.hyd_speed_available_mpm = +speed_avail_mpm.toFixed(2);
        r.hyd_hp_used_at_available = +hp_used_at_available.toFixed(2);
        r.hyd_elec_input_hp_used = +((h_emotor_eff > 0 ? r.hyd_hp_used_at_available / h_emotor_eff : 0)).toFixed(2);
        r.hyd_drum_rpm_flow = Number.isFinite(rpm_flow_drum)
          ? +Math.max(0, rpm_flow_drum).toFixed(1)
          : 0;
        r.hyd_drum_rpm_power = Number.isFinite(rpm_power_drum)
          ? +Math.max(0, rpm_power_drum).toFixed(1)
          : null;
        r.hyd_drum_rpm_available = Number.isFinite(rpm_available_drum)
          ? +Math.max(0, rpm_available_drum).toFixed(1)
          : 0;
      } else {
        r.hyd_drum_torque_maxP_Nm = 0;
        r.hyd_avail_tension_kgf = 0;
        r.hyd_P_required_psi = 0;
        r.hyd_speed_power_mpm = 0;
        r.hyd_speed_flow_mpm = 0;
        r.hyd_speed_available_mpm = 0;
        r.hyd_hp_used_at_available = 0;
        r.hyd_elec_input_hp_used = 0;
        r.hyd_drum_rpm_flow = 0;
        r.hyd_drum_rpm_power = 0;
        r.hyd_drum_rpm_available = 0;
      }
    }

    // ---- Drum visualization ----
    lastDrumState = { rows, summary, cfg, meta };
    renderDrumVisualization(rows, summary, cfg, meta);

    // ---- Aggregate into per-layer tables ----
    lastElLayer = electricEnabled ? rowsToElectricLayer(rows, payload_kg, cable_w_kgpm, gr1, gr2, motors) : [];
    lastHyLayer = hydraulicEnabled ? rowsToHydraulicLayer(rows) : [];
    lastElWraps = electricEnabled ? projectElectricWraps(rows) : [];
    lastHyWraps = hydraulicEnabled ? projectHydraulicWraps(rows) : [];

    // ---- Render tables ----
    renderElectricTables(lastElLayer, lastElWraps, q('tbody_el_layer'), q('tbody_el_wraps'));
    renderHydraulicTables(lastHyLayer, lastHyWraps, q('tbody_hy_layer'), q('tbody_hy_wraps'));

    renderInputSummary();
    renderLatexFragments(document.body);

    updateCsvButtonStates();

    // ---- Draw plots ----
    redrawPlots();
  } catch (e) {
    console.error(e);
    if (errBox) errBox.textContent = 'ERROR: ' + (e && e.message ? e.message : e);
    clearMinimumSystemHp();
    lastElLayer = lastElWraps = lastHyLayer = lastHyWraps = [];
    lastDrumState = null;
    clearDrumVisualization();
    clearPlots();
    updateCsvButtonStates();
    renderInputSummary();
    renderLatexFragments(document.body);
  }
}

// ---- Plot redraw helper (uses decoupled plotting modules) ----
function redrawPlots() {
  // Wave contours (optional - skip if controls/SVGs absent)
  const waveScenarioEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('wave_scenario'));
  const waveTminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_tmin'));
  const waveTmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_tmax'));
  const waveVminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_vmin'));
  const waveVmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_vmax'));
  const waveHminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_hmin'));
  const waveHmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('wave_hmax'));
  const waveSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg'));
  const waveSvgHeight = /** @type {SVGSVGElement|null} */ (document.getElementById('wave_svg_height'));

  const parseInput = (el) => {
    if (!el) return NaN;
    return parseFloat((el.value || '').replace(',', '.'));
  };

  if (waveScenarioEl && waveTminEl && waveTmaxEl && waveHmaxEl && waveSvg && waveSvgHeight) {
    const TminVal = parseInput(waveTminEl);
    const TmaxVal = parseInput(waveTmaxEl);
    const speedMinVal = parseInput(waveVminEl);
    const speedMaxVal = parseInput(waveVmaxEl);
    const HminVal = parseInput(waveHminEl);
    const HmaxVal = parseInput(waveHmaxEl);
    const waveOpts = {
      scenario: waveScenarioEl.value || 'electric',
      Tmin: Number.isFinite(TminVal) ? TminVal : 4,
      Tmax: Number.isFinite(TmaxVal) ? TmaxVal : 20,
      speedMin: Number.isFinite(speedMinVal) ? speedMinVal : undefined,
      speedMax: Number.isFinite(speedMaxVal) ? speedMaxVal : undefined,
      Hmin: Number.isFinite(HminVal) ? HminVal : undefined,
      Hmax: Number.isFinite(HmaxVal) ? HmaxVal : 6,
      elLayers: lastElLayer,
      hyLayers: lastHyLayer
    };
    drawWaveContours(waveSvg, waveOpts);
    drawWaveHeightContours(waveSvgHeight, waveOpts);
  }

  // Depth profiles (optional - skip if controls/SVGs absent)
  const depthSpeedSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_speed_svg'));
  const depthTensionSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('depth_tension_svg'));
  const depthXminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmin'));
  const depthXmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_xmax'));
  const depthSpeedYminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_speed_ymin'));
  const depthSpeedYmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_speed_ymax'));
  const depthTensionYminEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_tension_ymin'));
  const depthTensionYmaxEl = /** @type {HTMLInputElement|null} */ (document.getElementById('depth_tension_ymax'));

  if (depthSpeedSvg && depthTensionSvg) {
    const ratedSpeedMpmRaw = read('rated_speed_mpm');
    const ratedSpeedMs = Number.isFinite(ratedSpeedMpmRaw) ? ratedSpeedMpmRaw / 60 : null;
    const operatingDepthRaw = read('depth_m');
    const operatingDepth = Number.isFinite(operatingDepthRaw) ? operatingDepthRaw : null;
    const ratedSwlRaw = read('rated_swl_kgf');
    const ratedSwl = Number.isFinite(ratedSwlRaw) ? ratedSwlRaw : null;
    const depthXminVal = parseInput(depthXminEl);
    const depthXmaxVal = parseInput(depthXmaxEl);
    const depthSpeedMinVal = parseInput(depthSpeedYminEl);
    const depthSpeedMaxVal = parseInput(depthSpeedYmaxEl);
    const depthTensionMinVal = parseInput(depthTensionYminEl);
    const depthTensionMaxVal = parseInput(depthTensionYmaxEl);
    drawDepthProfiles(depthSpeedSvg, depthTensionSvg, {
      scenario: getActiveScenario(),       // 'electric' | 'hydraulic'
      elWraps: lastElWraps,
      hyWraps: lastHyWraps,
      payload_kg: read('payload_kg'),
      cable_w_kgpm: read('c_w_kgpm'),
      dead_end_m: read('dead_m'),
      rated_speed_ms: ratedSpeedMs,
      operating_depth_m: operatingDepth,
      rated_swl_kgf: ratedSwl,
      depth_xmin: Number.isFinite(depthXminVal) ? depthXminVal : undefined,
      depth_xmax: Number.isFinite(depthXmaxVal) ? depthXmaxVal : undefined,
      speed_ymin: Number.isFinite(depthSpeedMinVal) ? depthSpeedMinVal : undefined,
      speed_ymax: Number.isFinite(depthSpeedMaxVal) ? depthSpeedMaxVal : undefined,
      tension_ymin: Number.isFinite(depthTensionMinVal) ? depthTensionMinVal : undefined,
      tension_ymax: Number.isFinite(depthTensionMaxVal) ? depthTensionMaxVal : undefined
    });
  }

  const rpmTorqueSvg = /** @type {SVGSVGElement|null} */ (document.getElementById('hyd_rpm_torque_svg'));
  if (rpmTorqueSvg) {
    drawHydraulicRpmTorque(rpmTorqueSvg, {
      wraps: lastHyWraps
    });
  }
}

function clearPlots() {
  const svgs = [q('wave_svg'), q('wave_svg_height'), q('depth_speed_svg'), q('depth_tension_svg'), q('hyd_rpm_torque_svg')];
  svgs.forEach(svg => { if (!svg) return; while (svg.firstChild) svg.removeChild(svg.firstChild); });
}
