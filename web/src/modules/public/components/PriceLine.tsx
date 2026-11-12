// PriceLine (UI-SPEC P1, D-04): "Starts at {price} / pc · min. {n} pcs", or "Message us for a price".
export interface PriceLineProps {
  /** The server's starting price, or null for "Message us for a price". */
  price: number | string | null;
  /** The minimum order in pieces, or null for none. */
  minimum: number | string | null;
}

export function PriceLine({ price, minimum }: PriceLineProps) {
  void price;
  void minimum;
  return null;
}
