// The Contact page's sticky bar with the shop facts it needs (PUB-06). PublicLayout loads this as its own chunk on /contact only.
// The bar waits for the facts: it shows nothing while they load or fail.
import { useSiteQuery } from '../hooks/useSiteQuery';
import { ContactBar } from './ContactBar';

export default function ContactBarSlot() {
  const query = useSiteQuery();
  return <ContactBar site={query.status === 'success' ? query.data : undefined} />;
}
