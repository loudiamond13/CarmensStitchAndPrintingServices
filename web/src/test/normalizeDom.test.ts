// WEB-02, D-12, D-28: the differential DOM test compares the reconciled design system with the frozen reference
// after normalizeDom. Normalization may only hide React useId values, the lucide-react default classes, the svg
// xmlns attribute, attribute order and icon inner drawings (research Pattern 3). Everything else must still count.
import { describe, expect, it } from 'vitest';
import { normalizeDom } from './normalizeDom';

const ICON_A =
  '<svg class="csp-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path></svg>';

describe('normalizeDom: differences that must disappear', () => {
  it('maps React 19 client useId values (_r_N_) to the same placeholder by order of first use', () => {
    const a = '<label for="_r_1_">Name</label><input id="_r_1_" aria-describedby="_r_1_-msg"><p id="_r_1_-msg">x</p>';
    const b = '<label for="_r_7_">Name</label><input id="_r_7_" aria-describedby="_r_7_-msg"><p id="_r_7_-msg">x</p>';
    expect(normalizeDom(a)).toBe(normalizeDom(b));
  });

  it('maps the older :r1: useId form', () => {
    expect(normalizeDom('<input id=":r1:"><label for=":r1:">A</label>')).toBe(
      normalizeDom('<input id=":r4:"><label for=":r4:">A</label>'),
    );
  });

  it('maps the «r1» useId form', () => {
    expect(normalizeDom('<input id="«r1»"><label for="«r1»">A</label>')).toBe(
      normalizeDom('<input id="«r9»"><label for="«r9»">A</label>'),
    );
  });

  it('keeps two distinct ids distinct after mapping', () => {
    const same = '<input id="_r_1_"><input id="_r_1_">';
    const distinct = '<input id="_r_1_"><input id="_r_2_">';
    expect(normalizeDom(same)).not.toBe(normalizeDom(distinct));
  });

  it('drops the lucide and lucide-<name> classes (D-28) and keeps the csp-icon classes in order', () => {
    const lucide = ICON_A.replace('class="csp-icon"', 'class="lucide lucide-search lucide-filter csp-icon csp-spin"');
    const reference = ICON_A.replace('class="csp-icon"', 'class="csp-icon csp-spin"');
    expect(normalizeDom(lucide)).toBe(normalizeDom(reference));
  });

  it('drops the xmlns attribute on svg', () => {
    const withNs = ICON_A.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    expect(normalizeDom(withNs)).toBe(normalizeDom(ICON_A));
  });

  it('ignores attribute order', () => {
    expect(normalizeDom('<a class="csp-nav" href="/admin" title="Orders">x</a>')).toBe(
      normalizeDom('<a title="Orders" href="/admin" class="csp-nav">x</a>'),
    );
  });

  it('ignores the inner drawing of an svg with class csp-icon (D-12)', () => {
    const redrawn = ICON_A.replace('<path d="M5 12h14"></path>', '<line x1="4" x2="20" y1="5" y2="5"></line>');
    expect(normalizeDom(redrawn)).toBe(normalizeDom(ICON_A));
  });
});

describe('normalizeDom: differences that must stay visible', () => {
  it('a different tag name', () => {
    expect(normalizeDom('<a class="csp-nav">Logout</a>')).not.toBe(
      normalizeDom('<button class="csp-nav">Logout</button>'),
    );
  });

  it('a different class', () => {
    expect(normalizeDom('<span class="csp-badge csp-badge-info">x</span>')).not.toBe(
      normalizeDom('<span class="csp-badge csp-badge-success">x</span>'),
    );
  });

  it('a different class order', () => {
    expect(normalizeDom('<span class="a b">x</span>')).not.toBe(normalizeDom('<span class="b a">x</span>'));
  });

  it('a different aria attribute', () => {
    expect(normalizeDom('<span aria-label="Carmen Reyes">CR</span>')).not.toBe(
      normalizeDom('<span role="img" aria-label="Carmen Reyes">CR</span>'),
    );
  });

  it('a different aria value', () => {
    expect(normalizeDom('<div aria-hidden="true"></div>')).not.toBe(normalizeDom('<div aria-hidden="false"></div>'));
  });

  it('different text', () => {
    expect(normalizeDom('<p>CSPS onFacebook</p>')).not.toBe(normalizeDom('<p>CSPS on Facebook</p>'));
  });

  it('different whitespace text', () => {
    expect(normalizeDom('<p>a b</p>')).not.toBe(normalizeDom('<p>a  b</p>'));
  });

  it('the inner drawing of an svg that is not a csp-icon (the Mark is compared in full)', () => {
    const mark = '<svg class="csp-mark" viewBox="0 0 512 512"><rect width="512"></rect></svg>';
    expect(normalizeDom(mark)).not.toBe(normalizeDom(mark.replace('512"></rect>', '511"></rect>')));
  });

  it('a non-lucide class on an svg', () => {
    expect(normalizeDom(ICON_A.replace('class="csp-icon"', 'class="csp-icon on"'))).not.toBe(normalizeDom(ICON_A));
  });

  it('the icon wrapper attributes (size, stroke width, aria)', () => {
    expect(normalizeDom(ICON_A.replace('width="20"', 'width="18"'))).not.toBe(normalizeDom(ICON_A));
    expect(normalizeDom(ICON_A.replace('stroke-width="2"', 'stroke-width="1.5"'))).not.toBe(normalizeDom(ICON_A));
    expect(normalizeDom(ICON_A.replace(' aria-hidden="true"', ''))).not.toBe(normalizeDom(ICON_A));
  });

  it('an id that is not a React useId', () => {
    expect(normalizeDom('<input id="email">')).not.toBe(normalizeDom('<input id="phone">'));
  });
});
