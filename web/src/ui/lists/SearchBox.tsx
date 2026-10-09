// SPEC-GAP: SearchBox (RED stub, plan 02-30).
export interface SearchBoxProps {
  value: string | null;
  placeholder: string;
  onSearch: (text: string, options?: { immediate?: boolean }) => void;
  label?: string | undefined;
  id?: string | undefined;
}

export function SearchBox(props: SearchBoxProps) {
  void props;
  return <div />;
}
