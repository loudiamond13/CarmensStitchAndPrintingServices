// The signed-in person's profile (P1). Stale at once, so it is read again on window focus and whenever the page is opened,
// never on a timer (WEB-08): a name changed in another tab shows in the header after the focus read, while the open form
// keeps its own version and a stale save is refused with a 409 (D-20).
import { useQuery } from '@tanstack/react-query';
import { profileKey } from '@/lib/query/keys';
import { profileService } from '@/modules/admin/services/profileService';

export function useProfileQuery() {
  return useQuery({
    queryKey: profileKey,
    queryFn: ({ signal }) => profileService.get(signal),
    staleTime: 0,
  });
}
