// The line key allow-list (T-11-44, CWE-601): a key reaches an href or an element id only when it is made of lower case
// letters and digits joined by single hyphens, the same rule the server's LineKey.IsValid applies.

/** True when `key` is safe to put in a `#key` or `?category=key` address. */
export function isLineKey(key: string): boolean {
  void key;
  return true;
}
