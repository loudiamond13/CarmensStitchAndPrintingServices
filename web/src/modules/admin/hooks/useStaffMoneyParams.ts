import { useMoneyListParams } from '@/modules/admin/hooks/useMoneyListParams';

export function useStaffMoneyParams() {
  const [{ page, size, deleted }, set] = useMoneyListParams();
  return [{ page, size, deleted }, set] as const;
}
