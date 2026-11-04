// Stand-in so the first tests fail on their assertions (plan 09-21, RED). The real picker follows.
import type { Ref } from 'react';

export interface DraftPhoto {
  id: string;
  blob: Blob;
  name: string;
  preview: string | null;
  previewUnavailable: boolean;
  description: string;
}

export interface OrderPhotoPickerHandle {
  settled: () => Promise<void>;
}

export interface OrderPhotoPickerProps {
  value: readonly DraftPhoto[];
  onChange: (next: DraftPhoto[]) => void;
  onEditDescription?: ((id: string) => void) | undefined;
  handleRef?: Ref<OrderPhotoPickerHandle> | undefined;
}

export function OrderPhotoPicker(_props: OrderPhotoPickerProps) {
  return null;
}
