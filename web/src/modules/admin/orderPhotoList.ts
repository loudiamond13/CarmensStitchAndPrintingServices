// The saved photos of an order in the order they show (ORD-04, UI-SPEC P1; D-30). Shared by the Images card and the description
// window, so both read the same place and the same text for a photo.
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

export type OrderImage = OrderDetailResponse['images'][number];

export interface OrderPhotoPlace {
  image: OrderImage;
  /** The stored description, else the default text for the photo's place. */
  description: string;
}

/** The saved photos in display order, each with its description (the stored one, else the default for its position). */
export function orderedImages(order: OrderDetailResponse): OrderPhotoPlace[] {
  return [...order.images]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((image, index) => ({
      image,
      description: image.description ?? ORDER_PHOTOS_COPY.defaultDescription.saved(order.number, index + 1),
    }));
}
