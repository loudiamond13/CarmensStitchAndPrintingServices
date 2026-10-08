// @ts-check
// Reads an installed npm tree with license-checker-rseidelsohn (no network access). Shared by license-gate.mjs and
// third-party-notices.mjs; the policy itself is in license-policy.mjs.
import { init } from 'license-checker-rseidelsohn';

/** @typedef {import('./license-policy.mjs').NpmPackage} NpmPackage */

/**
 * Splits a license-checker key `name@version` (the name may start with `@`).
 * @param {string} key
 * @returns {{ name: string, version: string }}
 */
function splitKey(key) {
  const at = key.lastIndexOf('@');
  return at > 0 ? { name: key.slice(0, at), version: key.slice(at + 1) } : { name: key, version: '' };
}

/**
 * Lists every installed package under `start`: only the production dependencies when `production` is true, otherwise
 * the whole tree (production, development and their dependencies).
 * @param {string} start the folder that holds package.json and node_modules
 * @param {boolean} production
 * @returns {Promise<NpmPackage[]>}
 */
export function readTree(start, production) {
  return new Promise((resolve, reject) => {
    init({ start, production, json: true }, (error, modules) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(
        Object.entries(modules).map(([key, info]) => {
          const { name, version } = splitKey(key);
          /** @type {NpmPackage} */
          const item = { name, version, licenses: info.licenses };
          if (info.repository !== undefined) {
            item.repository = info.repository;
          }
          return item;
        }),
      );
    });
  });
}
