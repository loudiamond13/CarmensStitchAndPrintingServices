// RED stub (plan 02-21 Task 3): the toast queue arrives in the GREEN commit.
import type { ReactNode } from 'react';
import type { ToastTone } from './Toast';

export const MAX_TOASTS = 3;
export const AUTO_DISMISS_MS = 4500;

export function isPersistent(_tone: ToastTone): boolean {
  return false;
}

export interface ToastItem {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly message?: ReactNode;
  readonly action?: ReactNode;
}

export interface ToastInput {
  readonly tone?: ToastTone | undefined;
  readonly title: string;
  readonly message?: ReactNode;
  readonly action?: ReactNode;
}

export interface ToastQueueSnapshot {
  readonly toasts: readonly ToastItem[];
  readonly paused: boolean;
}

export interface ToastQueueOptions {
  readonly now: () => number;
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
}

export interface ToastQueue {
  show(input: ToastInput): number;
  dismiss(id: number): void;
  pause(): void;
  resume(): void;
  getSnapshot(): ToastQueueSnapshot;
  subscribe(listener: () => void): () => void;
}

const EMPTY: ToastQueueSnapshot = { toasts: [], paused: false };

export function createToastQueue(_options: ToastQueueOptions): ToastQueue {
  return {
    show: () => 0,
    dismiss: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    getSnapshot: () => EMPTY,
    subscribe: () => () => undefined,
  };
}
