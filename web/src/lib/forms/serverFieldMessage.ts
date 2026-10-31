// A server validation message for one form field. The server keys its messages by property name in its own casing
// (camelCase from the API, PascalCase from some validators), so the match ignores letter case.

/** The first message the server gave for `field`, or undefined when it gave none. */
export function serverFieldMessage(
  errors: Readonly<Record<string, readonly string[]>>,
  field: string,
): string | undefined {
  const wanted = field.toLowerCase();
  return Object.entries(errors).find(([key]) => key.toLowerCase() === wanted)?.[1][0];
}
