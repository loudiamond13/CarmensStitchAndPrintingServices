// PriceLine (UI-SPEC P1, D-04): "Starts at ₱650.00 / pc · min. 10 pcs", or "Message us for a price" in the same 28px look.
// The price is the server's value (Core Value); this only writes it with formatPeso.
import { formatPeso } from '@/utils/csps';
import { PUBLIC_COPY } from '../copy';
import { priceClasses, priceMutedClasses, priceStrongClasses } from './products.recipe';

const { article: COPY } = PUBLIC_COPY.products;

export interface PriceLineProps {
  /** The server's starting price, or null for "Message us for a price". */
  price: number | string | null;
  /** The minimum order in pieces, or null for none. */
  minimum: number | string | null;
}

export function PriceLine({ price, minimum }: PriceLineProps) {
  const minimumText = minimum === null ? '' : COPY.minimum(Number(minimum));
  if (price === null) {
    return (
      <div className={priceClasses}>
        <strong className={priceStrongClasses}>{COPY.noPrice}</strong>
        {minimumText !== '' && <span className={priceMutedClasses}>{minimumText}</span>}
      </div>
    );
  }
  return (
    <div className={priceClasses}>
      <span className={priceMutedClasses}>{COPY.startsAt}</span>
      <strong className={priceStrongClasses}>{formatPeso(price)}</strong>
      <span className={priceMutedClasses}>{`${COPY.perPiece}${minimumText}`}</span>
    </div>
  );
}
