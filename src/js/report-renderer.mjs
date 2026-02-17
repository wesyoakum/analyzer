function fmt(value, digits = 1) {
  if (!Number.isFinite(value)) return '–';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function tableFromRows(title, columns, rows) {
  const head = columns.map(c => `<th scope="col">${c.label}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns.map(c => `<td>${c.value(row)}</td>`).join('')}</tr>`).join('');
  return `<section class="report-block"><h3>${title}</h3><table class="worksheet"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

export function renderReport(reportRoot, model) {
  if (!reportRoot) return;
  if (!model) {
    reportRoot.innerHTML = '';
    reportRoot.setAttribute('aria-hidden', 'true');
    return;
  }
  reportRoot.setAttribute('aria-hidden', 'false');
  const projectName = String(model?.inputState?.project_name || 'Untitled project').trim() || 'Untitled project';
  const scenario = model.electricEnabled ? (model.hydraulicEnabled ? 'Electric + Hydraulic' : 'Electric') : 'Hydraulic';
  const summary = model.summary || {};
  const figures = [
    'Wave contours',
    'Depth profiles',
    'Hydraulic RPM & torque envelope',
    'Drum layout visualization'
  ];

  const summaryTable = `
    <section class="report-block">
      <h3>Table 1: Configuration summary</h3>
      <table class="worksheet">
        <tbody>
          <tr><th scope="row">Project</th><td>${projectName}</td></tr>
          <tr><th scope="row">Drive scenario</th><td>${scenario}</td></tr>
          <tr><th scope="row">Layers</th><td>${fmt(summary.total_layers, 0)}</td></tr>
          <tr><th scope="row">Wraps per layer (used)</th><td>${fmt(model.meta?.wraps_per_layer_used, 1)}</td></tr>
          <tr><th scope="row">Total cable capacity (m)</th><td>${fmt(summary.total_len_m, 1)}</td></tr>
        </tbody>
      </table>
    </section>`;

  const electricLayerTable = tableFromRows(
    'Table 2: Electric layer table',
    [
      { label: 'Layer', value: r => fmt(r.layer_no, 0) },
      { label: 'Diameter (in)', value: r => fmt(r.layer_dia_in, 2) },
      { label: 'Required tension (kgf)', value: r => fmt(r.tension_kgf, 1) },
      { label: 'Available speed (mpm)', value: r => fmt(r.line_speed_mpm, 2) }
    ],
    model.tables?.elLayer || []
  );

  const hydraulicLayerTable = tableFromRows(
    'Table 3: Hydraulic layer table',
    [
      { label: 'Layer', value: r => fmt(r.layer_no, 0) },
      { label: 'Pressure req. (psi)', value: r => fmt(r.hyd_P_required_psi, 0) },
      { label: 'Available speed (mpm)', value: r => fmt(r.hyd_speed_available_mpm, 2) },
      { label: 'Available tension (kgf)', value: r => fmt(r.hyd_avail_tension_kgf, 1) }
    ],
    model.tables?.hyLayer || []
  );

  reportRoot.innerHTML = `
    <article class="report-document" aria-label="Printable report">
      <header>
        <h1>Winch Analyzer Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      </header>
      ${summaryTable}
      <section class="report-block"><h3>Figures</h3>${figures.map((t, i) => `<p>Figure ${i + 1}: ${t}</p>`).join('')}</section>
      ${electricLayerTable}
      ${hydraulicLayerTable}
      <section class="report-block">
        <h3>Equations summary</h3>
        <ul>
          <li><span data-latex="T=\left(m_{p}+w_{c}L\right)g">T = (m_p + w_c L) g</span></li>
          <li><span data-latex="v=\omega r">v = \omega r</span></li>
          <li><span data-latex="P=T\omega">P = T \omega</span></li>
        </ul>
      </section>
    </article>`;
}
