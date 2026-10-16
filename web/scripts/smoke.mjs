// @ts-check
// Skeleton for the RED commit: the exports exist with their final shapes and give wrong answers.

/**
 * @typedef {{ method: string, url: string, headers?: Record<string, string>, body?: string, servername?: string, insecureTls?: boolean }} SmokeRequest
 * @typedef {{ status: number, headers: Record<string, string>, body: string }} SmokeResponse
 * @typedef {(request: SmokeRequest) => Promise<SmokeResponse>} Send
 * @typedef {{ name: string, ok: boolean, detail: string }} CheckResult
 * @typedef {{ origin: string, send?: Send, now?: () => number, sleep?: (ms: number) => Promise<void>, only?: readonly string[], insecureTls?: boolean }} SmokeOptions
 * @typedef {{ send: Send, now: () => number, sleep: (ms: number) => Promise<void>, stdout: (text: string) => void, stderr: (text: string) => void, appendFile: (file: string, text: string) => void }} MainDeps
 */

/** @type {readonly { readonly name: string }[]} */
export const CHECKS = Object.freeze([]);

/**
 * @param {readonly CheckResult[]} results
 * @returns {{ ok: boolean, lines: string[] }}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function evaluate(results) {
  return { ok: true, lines: [] };
}

/**
 * @param {SmokeOptions} options
 * @returns {Promise<CheckResult[]>}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function runSmoke(options) {
  return Promise.resolve([]);
}

/**
 * @param {readonly string[]} argv
 * @param {Readonly<Record<string, string | undefined>>} env
 * @param {Partial<MainDeps>} [deps]
 * @returns {Promise<number>}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function main(argv, env, deps) {
  return Promise.resolve(0);
}
