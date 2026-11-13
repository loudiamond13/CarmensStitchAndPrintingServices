export function useGalleryCategory(
  _keys: readonly string[] | undefined,
): readonly [string | null, (next: string | null) => void] {
  return [null, () => undefined];
}
