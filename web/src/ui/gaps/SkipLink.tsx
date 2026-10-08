// RED placeholder (plan 02-12 Task 2): the real SkipLink replaces this in the GREEN commit.
export function SkipLink({ targetId = 'main' }: { targetId?: string }) {
  return <a href={`#${targetId}`}>Skip</a>;
}
