// RED stub (plan 02-19 Task 2): replaced in GREEN.
export interface AvatarProps {
  name?: string | undefined;
  size?: number | undefined;
  className?: string | undefined;
}

export function Avatar({ name = '' }: AvatarProps) {
  return <span>{name}</span>;
}
