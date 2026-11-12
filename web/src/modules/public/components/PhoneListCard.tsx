import type { PublicPhone } from '../siteFacts';

export function PhoneListCard(props: { phones: readonly PublicPhone[] }) {
  return <span data-stub={String(props.phones.length)} hidden />;
}
