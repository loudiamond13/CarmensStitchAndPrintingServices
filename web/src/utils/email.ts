// The browser copy of OrderRules.IsValidEmail (OR-3): the quote form and the order forms both check an email with it, so a value
// one form accepts is never refused by the other. Its cases are in tests/fixtures/email-cases.json (quoteEmail).

/** What OrderRules.IsValidEmail refuses in either part: ASCII spaces and control characters, and the marks `" ( ) , : ; < > [ \ ]`. */
// eslint-disable-next-line no-control-regex -- the control characters are what the rule refuses
const EMAIL_REFUSED_CHARACTERS = /[\u0000- \u007f"(),:;<>[\\\]]/u;

/**
 * A plain address with a dotted domain and no display name, as OrderRules.IsValidEmail reads it (the .NET mail parser). It refuses
 * what the server refuses for the characters above and for dots in the wrong place: a leading dot, a double dot or an empty
 * domain part. It is stricter than the server only on a quoted local part, an IP address as the domain and a domain that ends in
 * a lone dot, which no visitor types. A few rare letters that .NET rewrites are left to the server. No regular expression
 * runs over the whole text, so nothing can backtrack (CWE-1333).
 */
export function isPlainEmail(text: string): boolean {
  const at = text.indexOf('@');
  if (at <= 0 || at !== text.lastIndexOf('@') || EMAIL_REFUSED_CHARACTERS.test(text)) {
    return false;
  }
  const local = text.slice(0, at).split('.');
  if (local.length > 1 && local[local.length - 1] === '') {
    local.pop();
  }
  const domain = text.slice(at + 1).split('.');
  if (domain.length > 2 && domain[domain.length - 1] === '') {
    domain.pop();
  }
  return domain.length > 1 && domain.every((part) => part !== '') && local.every((part) => part !== '');
}
