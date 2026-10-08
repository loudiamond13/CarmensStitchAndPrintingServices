// RED placeholder (plan 13 Task 2): replaced by the implementation in the GREEN commit.
export interface SearchBoxProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  label?: string;
  id?: string;
}

export function SearchBox({ value, placeholder }: SearchBoxProps) {
  return <input aria-label="Search" defaultValue={value} placeholder={placeholder} />;
}
