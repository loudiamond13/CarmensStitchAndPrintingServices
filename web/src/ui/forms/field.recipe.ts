// RED stub (plan 02-20 Task 1): the field looks are not transcribed yet.
import { tw } from '@/ui/tw';

export const fieldClasses = tw('');
export const labelClasses = tw('');
export const requiredClasses = tw('');
export const fieldControlClasses = tw('');
export const prefixClasses = tw('');

export interface FieldInputOptions {
  multiline?: boolean;
  prefix?: boolean;
  end?: 'plain' | 'suffix' | 'select';
}

export function fieldInputClasses(_options: FieldInputOptions = {}): string {
  return tw('');
}

export function messageClasses(_options: { error: boolean }): string {
  return tw('');
}
