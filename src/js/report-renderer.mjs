function fmt(value, digits = 1) {
  if (!Number.isFinite(value)) return '–';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function tableFromRows(title, columns, rows, sectionId) {
  const head = columns.map(c => `<th scope="col">${c.label}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns.map(c => `<td>${c.value(row)}</td>`).join('')}</tr>`).join('');
  return `<section id="${sectionId}" class="report-block report-section-table report-print-section report-print-section--tables"><div class="report-table-wrap report-print-keep-with-content"><h3 class="report-item-label">${title}</h3><table class="worksheet report-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}

export function renderReportHtml(model, options = {}) {
  if (!model) return '';

  const generatedAt = options.generatedAt instanceof Date ? options.generatedAt : new Date();
  const projectName = String(model?.inputState?.project_name || 'Untitled project').trim() || 'Untitled project';
  const scenario = model.electricEnabled ? (model.hydraulicEnabled ? 'Electric + Hydraulic' : 'Electric') : 'Hydraulic';
  const summary = model.summary || {};
  const figures = Array.isArray(model?.report?.figures) && model.report.figures.length
    ? model.report.figures
    : [
    'Wave contours',
    'Depth profiles',
    'Hydraulic RPM & torque envelope',
    'Drum layout visualization'
  ];

  const summaryTable = `
    <section id="report-summary" class="report-block report-section-summary report-print-section report-print-section--cover-meta">
      <div class="report-table-wrap report-print-keep-with-content">
        <h3 class="report-item-label">Table 1: Configuration summary</h3>
        <table class="worksheet report-table">
          <tbody>
            <tr><th scope="row">Project</th><td>${escapeHtml(projectName)}</td></tr>
            <tr><th scope="row">Drive scenario</th><td>${escapeHtml(scenario)}</td></tr>
            <tr><th scope="row">Layers</th><td>${fmt(summary.total_layers, 0)}</td></tr>
            <tr><th scope="row">Wraps per layer (used)</th><td>${fmt(model.meta?.wraps_per_layer_used, 1)}</td></tr>
            <tr><th scope="row">Total cable capacity (m)</th><td>${fmt(summary.cable_len_m, 1)}</td></tr>
          </tbody>
        </table>
      </div>
    </section>`;

  const figuresSection = `
    <section id="report-figures" class="report-block report-section-figures report-print-section report-print-section--charts">
      <h3>Figures</h3>
      <div class="report-figure-grid">
        ${figures.map((title, i) => `<figure class="report-figure report-print-keep-with-content"><figcaption class="report-item-label">Figure ${i + 1}: ${escapeHtml(title)}</figcaption><div class="report-figure-body">Rendered chart content for ${escapeHtml(title)}</div></figure>`).join('')}
      </div>
    </section>`;

  const equations = Array.isArray(model?.report?.equations) && model.report.equations.length
    ? model.report.equations
    : [
      { latex: 'T=\\left(m_{p}+w_{c}L\\right)g', text: 'T = (m_p + w_c L) g' },
      { latex: 'v=\\omega r', text: 'v = \\omega r' },
      { latex: 'P=T\\omega', text: 'P = T \\omega' }
    ];

  const electricLayerTable = tableFromRows(
    'Table 2: Electric layer table',
    [
      { label: 'Layer', value: r => fmt(r.layer_no, 0) },
      { label: 'Diameter (in)', value: r => fmt(r.layer_dia_in, 2) },
      { label: 'Required tension (kgf)', value: r => fmt(r.tension_kgf, 1) },
      { label: 'Available speed (mpm)', value: r => fmt(r.line_speed_mpm, 2) }
    ],
    model.tables?.elLayer || [],
    'report-electric-layer-table'
  );

  const hydraulicLayerTable = tableFromRows(
    'Table 3: Hydraulic layer table',
    [
      { label: 'Layer', value: r => fmt(r.layer_no, 0) },
      { label: 'Pressure req. (psi)', value: r => fmt(r.hyd_P_required_psi, 0) },
      { label: 'Available speed (mpm)', value: r => fmt(r.hyd_speed_available_mpm, 2) },
      { label: 'Available tension (kgf)', value: r => fmt(r.hyd_avail_tension_kgf, 1) }
    ],
    model.tables?.hyLayer || [],
    'report-hydraulic-layer-table'
  );

  return `
    <article id="report-document" class="report-document report-print-document" aria-label="Printable report">
      <header id="report-header" class="report-header report-print-section report-print-section--cover-meta">
        <h1>Winch Analyzer Report</h1>
        <p><strong>Generated:</strong> ${generatedAt.toLocaleString()}</p>
      </header>
      ${summaryTable}
      ${figuresSection}
      ${electricLayerTable}
      ${hydraulicLayerTable}
      <section id="report-equations" class="report-block report-section-equations report-print-section report-print-section--appendices">
        <h3>Equations summary</h3>
        <ul class="report-equation-list">
          ${equations.map((item) => `<li class="report-equation-card report-print-keep-with-content"><div class="report-item-label">Equation</div><span data-latex="${escapeHtml(item.latex)}">${escapeHtml(item.text)}</span></li>`).join('')}
        </ul>
      </section>
      <section id="report-appendix" class="report-block report-section-appendix report-print-section report-print-section--appendices">
        <h3>Appendix</h3>
        <p class="report-print-keep-with-content">Generated report metadata and derivation notes are included for audit and handoff workflows.</p>
      </section>
    </article>`;
}

export function renderReport(reportRoot, model) {
  if (!reportRoot) return;
  if (!model) {
    reportRoot.innerHTML = '';
    reportRoot.setAttribute('aria-hidden', 'true');
    return;
  }
  reportRoot.setAttribute('aria-hidden', 'false');
  reportRoot.innerHTML = renderReportHtml(model);
}
