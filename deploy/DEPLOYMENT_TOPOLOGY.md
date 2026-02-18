# Deployment topology

- Static assets are served directly from `src/`:
  - `/` -> `src/index.html`
  - `/src/*` -> files under `src/`
- API traffic is reverse-proxied to the Node process started by `npm start` (`server/index.js`) on `PORT`.
- `/api/reports/pdf` is explicitly configured to allow `POST` (and `OPTIONS` for CORS preflight), then forwarded to Node.
- All `/api/*` requests bypass static handling and are always passed to Node.

## Deployment smoke checks

- Confirm API health responds from Node:
  ```bash
  curl -si http://localhost/api/health
  ```
  - Expect: HTTP `200` with `Content-Type: application/json` and body `{"ok":true,"service":"analyzer-api"}`.

- Confirm PDF endpoint reaches Node (not proxied HTML fallback):
  ```bash
  curl -si -X POST http://localhost/api/reports/pdf \
    -H 'Content-Type: application/json' \
    -d '{}'
  ```
  - Expect: HTTP `400` with JSON error from Node, **not** `200` HTML.
