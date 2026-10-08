import type { ComponentType, ReactElement } from 'react';
import type { ScenarioNode } from './scenarios/types';

export type Kit = Readonly<Record<string, ComponentType<never>>>;

// RED stub (plan 02-38 Task 1): renders nothing.
export function renderNode(kit: Kit, node: ScenarioNode, handlers: readonly string[]): ReactElement | null {
  void kit;
  void node;
  void handlers;
  return null;
}
