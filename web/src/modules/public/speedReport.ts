// The speed reader (ANL-05, D-38): web-vitals reads loading speed, layout shift and tap response for the visitor's own
// page load. Only useSpeedReport loads this file, with a dynamic import after a stats yes, so web-vitals stays in its own
// chunk and never in the first download (PERF-01). Default options: no reportAllChanges, no soft navigations.
import { onCLS, onINP, onLCP } from 'web-vitals';

export type VitalName = 'LCP' | 'CLS' | 'INP';
export type VitalReport = (name: VitalName, value: number) => void;

export function startSpeedReport(report: VitalReport): void {
  onLCP((metric) => {
    report('LCP', metric.value);
  });
  onCLS((metric) => {
    report('CLS', metric.value);
  });
  onINP((metric) => {
    report('INP', metric.value);
  });
}
