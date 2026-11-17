// The speed reader (ANL-05, D-38): reads loading speed, layout shift and tap response for the visitor's own page load.
export type VitalName = 'LCP' | 'CLS' | 'INP';
export type VitalReport = (name: VitalName, value: number) => void;

export function startSpeedReport(report: VitalReport): void {
  void report;
}
