import type { PublicSite } from '../services/siteService';

export function ContactBar(props: { site: PublicSite | undefined }) {
  return <span data-stub={props.site === undefined ? 'loading' : 'ready'} hidden />;
}
