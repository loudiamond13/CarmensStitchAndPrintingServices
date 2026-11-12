import type { IconName } from '@/components/brand/icons';

export interface BigContactButtonProps {
  tone: 'primary' | 'outline';
  href: string;
  icon: IconName;
  title: string;
  note?: string;
}

export function BigContactButton(props: BigContactButtonProps) {
  return <span data-stub={props.title} hidden />;
}
