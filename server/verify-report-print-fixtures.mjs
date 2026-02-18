import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReportHtml } from '../src/js/report-renderer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../data/report-print-fixtures');

const fixtureNames = [
  'long-tables-and-figures.json',
  'appendix-heavy-mixed-content.json'
];

for (const fixtureName of fixtureNames) {
  const fixturePath = path.join(fixturesDir, fixtureName);
  const fixturePayload = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const html = renderReportHtml(fixturePayload, { generatedAt: new Date('2025-01-01T00:00:00.000Z') });

  const checks = [
    ['cover/meta print section', /report-print-section--cover-meta/.test(html)],
    ['charts print section', /report-print-section--charts/.test(html)],
    ['tables print section', /report-print-section--tables/.test(html)],
    ['appendices print section', /report-print-section--appendices/.test(html)],
    ['table wrapper', /report-table-wrap/.test(html)],
    ['figure blocks', /report-figure/.test(html)],
    ['equation cards', /report-equation-card/.test(html)]
  ];

  const missing = checks.filter(([, pass]) => !pass).map(([label]) => label);
  if (missing.length > 0) {
    throw new Error(`${fixtureName} failed checks: ${missing.join(', ')}`);
  }

  const rowCount = (html.match(/<tr>/g) || []).length;
  const figureCount = (html.match(/class="report-figure /g) || []).length;
  console.log(`${fixtureName}: ${rowCount} rows, ${figureCount} figures`);
}

console.log('Report print fixture verification passed.');
