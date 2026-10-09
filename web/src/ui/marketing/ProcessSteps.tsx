// RED stub (plan 02-25 Task 2): replaced by the converted ProcessSteps in the GREEN commit.
import type { IconName } from '@/ui/brand';

export interface ProcessStep {
  title: string;
  description: string;
  icon?: IconName | undefined;
}

export interface ProcessStepsProps {
  steps: ProcessStep[];
}

export function ProcessSteps(props: ProcessStepsProps) {
  return <div data-stub={props.steps.length} />;
}
