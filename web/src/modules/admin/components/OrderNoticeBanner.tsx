// RED stub (plan 08-23): replaced in the GREEN commit.
import type { ReactNode } from 'react';
import type { IconName } from '@/components/brand';

export interface OrderNoticeBannerProps {
  icon: IconName;
  title: ReactNode;
  message: string;
  children?: ReactNode;
}

export function OrderNoticeBanner(_props: OrderNoticeBannerProps): ReactNode {
  return null;
}
