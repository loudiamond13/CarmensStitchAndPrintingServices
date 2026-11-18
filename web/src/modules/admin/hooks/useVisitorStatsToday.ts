// The business today for the Visitor Stats custom range (D-24), kept once known. A held answer is trusted for a few minutes
// only, and the hook goes back to null after that until the next refetch. The range inputs and the stats query must not lose
// their limits meanwhile, so the last date given is kept.
import { useState } from 'react';
import { useBusinessTodayState, type BusinessTodayState } from '@/modules/admin/hooks/useBusinessToday';

export function useVisitorStatsToday(enabled: boolean): BusinessTodayState {
  const state = useBusinessTodayState(enabled);
  const [last, setLast] = useState(state.today);
  if (state.today !== null && state.today !== last) {
    setLast(state.today);
  }
  return { ...state, today: state.today ?? last };
}
