// Reference side of the chip-less media placeholder (plan 02-18; test only, never shipped). App. D.3 has no chip-less
// prop: the approved design hides the chip with parent rules (App. B `.csp-thumb .csp-media-ph-label`, App. C
// `.s-tile .csp-media-ph-label { display: none }`). This is App. D.3's MediaPlaceholder markup, classes and name
// verbatim, without the hidden chip: a `display: none` subtree paints nothing and the comparison skips it.
export interface MediaPlaceholderNoChipProps {
  ratio?: string;
  number?: string | number;
}

export function MediaPlaceholderNoChip({ ratio = '4 / 3', number }: MediaPlaceholderNoChipProps) {
  return (
    <div className="csp-media-ph csp-mesh" style={{ aspectRatio: ratio }} role="img" aria-label="No image yet">
      {number != null && number !== '' && (
        <span className="csp-media-ph-num" aria-hidden="true">
          {number}
        </span>
      )}
    </div>
  );
}
