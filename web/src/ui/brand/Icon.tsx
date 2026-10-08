// RED placeholder (plan 02-40 Task 1): renders nothing useful until the lucide-react wrapper lands.
export interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function Icon(props: IconProps) {
  return <span data-name={props.name} />;
}
