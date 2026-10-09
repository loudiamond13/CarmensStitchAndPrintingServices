// RED stub (plan 02-25 Task 2): replaced by the converted TestimonialCard in the GREEN commit.
export interface TestimonialCardProps {
  quote: string;
  name: string;
  team: string;
  rating?: number | undefined;
}

export function TestimonialCard(props: TestimonialCardProps) {
  return <div data-stub={props.name} />;
}
