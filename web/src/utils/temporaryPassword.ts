// RED stub (plan 05-22): the readable temporary password, written in the GREEN commit.
export type RandomFill = (buffer: Uint32Array) => unknown;

export const TEMPORARY_PASSWORD_WORDS: readonly string[] = [];

export function newTemporaryPassword(previous?: string, random?: RandomFill): string {
  void previous;
  void random;
  return '';
}
