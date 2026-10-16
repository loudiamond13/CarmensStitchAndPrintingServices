// @ts-check
// Skeleton for the RED commit: every export has its final shape and gives a wrong answer.
/* eslint-disable @typescript-eslint/no-unused-vars -- RED skeleton, replaced in the GREEN commit */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MSDEPLOY_PATH = '';
export const APP_OFFLINE_PATH = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
export const RELEASE_PATTERN = /^$/;
export const OFFLINE_WAIT_MS = 0;

/** @param {Record<string, string | undefined>} _values */
export function buildDestination(_values) {
  return '';
}
/** @param {Record<string, unknown>} _values @returns {string[]} */
export function syncArgs(_values) {
  return [];
}
/** @param {Record<string, unknown>} _values @returns {string[]} */
export function offlineArgs(_values) {
  return [];
}
/** @param {Record<string, unknown>} _values @returns {string[]} */
export function onlineArgs(_values) {
  return [];
}
/** @param {string} text @param {readonly (string | undefined)[]} _secrets */
export function redact(text, _secrets) {
  return text;
}
/** @param {Date} _date @param {string} _sha */
export function releaseTag(_date, _sha) {
  return '';
}
/** @param {readonly { tagName: string, createdAt: string, isDraft: boolean }[]} _releases @param {string} _sha */
export function selectLastGood(_releases, _sha) {
  return /** @type {{ tagName: string } | null} */ (null);
}
/**
 * @typedef {{ name: string, kind: string, command?: string, args?: readonly string[], verbatim?: boolean, ms?: number, commands?: readonly { command: string, args: readonly string[] }[] }} Step
 * @param {Record<string, unknown>} _values
 * @returns {Step[]}
 */
export function planDeploy(_values) {
  return [];
}
/** @param {Record<string, unknown>} _values @returns {Step[]} */
export function planRollback(_values) {
  return [];
}
/** @param {{ host: string, expected: string | undefined, connect: (host: string, port: number) => Promise<string> }} _values */
export function certificatePinOk(_values) {
  return Promise.resolve(true);
}
/** @param {string} _sha @param {Record<string, unknown>} _deps @returns {Promise<{ source: string, packageDir: string }>} */
export function findPackage(_sha, _deps) {
  return Promise.resolve({ source: '', packageDir: '' });
}
/** @param {readonly Step[]} _steps @param {Record<string, unknown>} _deps @returns {Promise<{ exitCode: number, releaseTag?: string }>} */
export function executeDeploy(_steps, _deps) {
  return Promise.resolve({ exitCode: 1 });
}
/** @param {Record<string, string | undefined>} _env @param {Record<string, unknown>} _deps @param {readonly string[]} _argv */
export function main(_env, _deps, _argv) {
  return Promise.resolve(0);
}
