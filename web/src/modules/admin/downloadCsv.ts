// Saves CSV text as a file in the browser's downloads (ANL-08, D-25): a blob: URL and a temporary a[download] click, so
// no CSP change is needed.

/** Saves `text` as `fileName`. */
export function downloadCsv(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
}
