# Report print regression fixtures

These fixtures stress multi-page print behavior in generated report HTML.

- `long-tables-and-figures.json`: very large electric/hydraulic tables and many chart blocks.
- `appendix-heavy-mixed-content.json`: long hydraulic table with a large equation appendix.

Run `node server/verify-report-print-fixtures.mjs` to render both fixtures and verify expected print section classes and block wrappers are present.
