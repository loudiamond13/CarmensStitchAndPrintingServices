// RED stub (plan 02-25 Task 1): replaced by the converted ImageUploader in the GREEN commit.
import type { OrderImage } from '@/lib/csps';

export interface ImageUploaderProps {
  images?: OrderImage[] | undefined;
  defaultImages?: OrderImage[] | undefined;
  onChange?: ((images: OrderImage[]) => void) | undefined;
  onFiles?: ((files: File[]) => void) | undefined;
  max?: number | undefined;
}

export function ImageUploader(props: ImageUploaderProps) {
  return <div data-stub={props.max} />;
}
