// ===== spec-sheet-export.mjs — ABB Smart Winch Spec Sheet PDF export =====
//
// Posts the current analyzer state to the server, which fills the
// fillable ABB PDF template and returns it as a download.

import { collectInputState } from './persist-inputs.mjs';
import { apiUrl, apiHeaders } from './api-config.mjs';

/**
 * Download a filled ABB Spec Sheet PDF from the server.
 */
export async function downloadSpecSheetPDF() {
  const state = collectInputState();

  const res = await fetch(apiUrl('/api/spec-sheet/pdf'), {
    method: 'POST',
    headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message || `Server error ${res.status}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : 'ABB_SpecSheet.pdf';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
