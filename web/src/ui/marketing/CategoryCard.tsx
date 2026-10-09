// RED stub (plan 02-25 Task 2): replaced by the converted CategoryCard in the GREEN commit.
export interface CategoryCardProps {
  title: string;
  description: string;
  number?: string | undefined;
  image?: string | undefined;
  href?: string | undefined;
}

export function CategoryCard(props: CategoryCardProps) {
  return <div data-stub={props.title} />;
}
