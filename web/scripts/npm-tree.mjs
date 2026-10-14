// @ts-check
// Reads an installed npm tree with license-checker-rseidelsohn and the folder's package-lock.json (no network access).
// Shared by license-gate.mjs and third-party-notices.mjs; the policy itself is in license-policy.mjs.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { init } from 'license-checker-rseidelsohn';
import { attributeScopes } from './license-policy.mjs';

/** @typedef {import('./license-policy.mjs').NpmPackage} NpmPackage */
/** @typedef {import('./license-policy.mjs').Lockfile} Lockfile */
/** @typedef {NpmPackage & { path?: string, licenseFile?: string }} InstalledPackage */

/** A license file name: LICENSE, LICENCE or COPYING, with or without an extension or suffix. */
const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:[.-].*)?$/i;

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
 * @returns {Promise<InstalledPackage[]>}
 */
export function readTree(start, production) {
  return new Promise((resolve, reject) => {
    init({ start, production, json: true }, (error, modules) => {
      if (error instanceof Error) {
        reject(error);
        return;
      }
      resolve(
        Object.entries(modules).map(([key, info]) => {
          /** @type {InstalledPackage} */
          const item = { ...splitKey(key), licenses: info.licenses };
          if (info.repository !== undefined) {
            item.repository = info.repository;
          }
          if (info.path !== undefined) {
            item.path = info.path;
          }
          if (info.licenseFile !== undefined) {
            item.licenseFile = info.licenseFile;
          }
          return item;
        }),
      );
    });
  });
}

/**
 * Why each package under `start` is installed: package-lock.json read through attributeScopes, with the registry scope
 * of each direct dependency. Only packages present in node_modules count.
 * @param {string} start
 * @param {ReadonlyMap<string, string>} direct
 * @returns {Map<string, string[]>}
 */
export function readScopes(start, direct) {
  /** @type {unknown} */
  const lock = JSON.parse(readFileSync(path.join(start, 'package-lock.json'), 'utf8'));
  return attributeScopes(/** @type {Lockfile} */ (lock), direct, (key) =>
    existsSync(path.join(start, key, 'package.json')),
  );
}

/**
 * Attaches the scopes of each package (by `name@version`); a package the lockfile does not explain gets none.
 * @template {NpmPackage} T
 * @param {readonly T[]} packages
 * @param {ReadonlyMap<string, readonly string[]>} scopes
 * @returns {T[]}
 */
export function withScopes(packages, scopes) {
  return packages.map((item) => ({ ...item, scopes: scopes.get(`${item.name}@${item.version}`) ?? [] }));
}

/**
 * The full text of the package's own license file (LICENSE, LICENCE or COPYING), or undefined when it ships none.
 * license-checker falls back to a README when there is no license file; that guess is not used here.
 * @param {InstalledPackage} item
 * @returns {string | undefined}
 */
export function readLicenseText(item) {
  if (item.licenseFile !== undefined && LICENSE_FILE.test(path.basename(item.licenseFile))) {
    return readFileSync(item.licenseFile, 'utf8');
  }
  if (item.path === undefined) {
    return undefined;
  }
  const candidates = readdirSync(item.path)
    .filter((name) => LICENSE_FILE.test(name))
    .sort();
  const first = candidates[0];
  return first === undefined ? undefined : readFileSync(path.join(item.path, first), 'utf8');
}
