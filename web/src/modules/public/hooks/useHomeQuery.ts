import type { PublicResourceState } from '@/lib/public-data/publicResource';
import type { PublicHome } from '../services/contentService';

export function useHomeQuery(): PublicResourceState<PublicHome> {
  return { status: 'loading' };
}
