// Saves CSV text as a file in the browser's downloads (ANL-08, D-25): a blob: URL and a temporary a[download] click, so
// no CSP change is needed.

/** Pitfall 3: fetch drops the byte-order mark, and a spreadsheet needs it to read the file as UTF-8. */
const BOM = '\uFEFF';

const REVOKE_AFTER_MS = 10_000;

/** Saves `text` as `fileName`, starting with exactly one byte-order mark. */
export function downloadCsv(text: string, fileName: string): void {
  const body = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const url = URL.createObjectURL(new Blob([BOM, body], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Safari can fail a download whose URL is revoked at once, so it is let go a little later.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_AFTER_MS);
}
