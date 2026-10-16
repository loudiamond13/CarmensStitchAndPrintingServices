// @ts-check
// `node web/scripts/deploy.mjs [--plan]` (OPS-04, D-11, D-12, D-13): the production deploy that deploy.yml runs on
// windows-2025, driven by environment variables. A deploy is data first: pure builders make the msdeploy arguments,
// planDeploy lists the steps, and executeDeploy runs them through an injected spawn.
//   1. Upload the branded tools/deploy/app_offline.htm to the site root and wait 5 seconds (msdeploy's own AppOffline
//      rule writes a different file name and cannot carry the branded page).
//   2. Sync the package (skipping the host logs folder and app_offline.htm, deleting stale files).
//   3. Delete app_offline.htm, run the smoke test, and on a pass create the release deploy-<UTC time>-<sha7>.
// The Web Deploy password is redacted from every printed line (CWE-532) and never reaches a shell: msdeploy, gh, tar and
// node are spawned directly. Node built-ins only, because deploy.yml runs this without `npm ci`.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {{ server: string, site: string, userName: string, password: string }} Connection
 * @typedef {{ command: string, args: readonly string[] }} Command
 * @typedef {{ readonly name: string, readonly kind: 'run' | 'wait' | 'sequence', readonly command?: string,
 *   readonly args?: readonly string[], readonly verbatim?: boolean, readonly ms?: number,
 *   readonly commands?: readonly Command[], readonly tag?: string }} Step
 * @typedef {{ tag: string, packageDir: string }} LastGood
 * @typedef {{ connection: Connection, allowUntrusted: boolean, origin: string, sha: string, tag: string, workDir: string }} DeployConfig
 * @typedef {'rollback' | 'offline' | 'none'} OnFailure
 * @typedef {readonly Step[] & { rollback: { tag: string, steps: readonly Step[] } | null, onFailure: OnFailure }} Plan
 * @typedef {{ windowsVerbatimArguments?: boolean, argv0?: string, cwd?: string }} SpawnOptions
 * @typedef {{ status: number | null, stdout?: string, stderr?: string }} SpawnResult
 * @typedef {(command: string, args: readonly string[], options: SpawnOptions) => SpawnResult} Spawn
 * @typedef {{ tagName: string, createdAt: string, isDraft: boolean }} Release
 * @typedef {{ spawn: Spawn, sleep: (ms: number) => Promise<void>, log: (text: string) => void, secrets: readonly (string | undefined)[] }} ExecuteDeps
 * @typedef {{ exitCode: number, results: { name: string, ok: boolean }[], messages: string[], releaseTag?: string }} DeployResult
 * @typedef {{ spawn: Spawn, sleep: (ms: number) => Promise<void>, now: () => Date, log: (text: string) => void,
 *   exists: (file: string) => boolean, mkdir: (dir: string) => void, appendFile: (file: string, text: string) => void,
 *   connectTls: (host: string, port: number) => Promise<string>, readFile: (file: string) => string,
 *   writeFile: (file: string, text: string) => void }} MainDeps
 */

export const MSDEPLOY_PATH = 'C:\\Program Files\\IIS\\Microsoft Web Deploy V3\\msdeploy.exe';
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const APP_OFFLINE_PATH = path.join(REPO_ROOT, 'tools', 'deploy', 'app_offline.htm');
/** A deploy release tag: deploy-<yyyyMMddHHmmss UTC>-<sha7>. Tags embed seconds, so two deploys never share one. */
export const RELEASE_PATTERN = /^deploy-\d{14}-[0-9a-f]{7}$/;
/** Time for the ASP.NET Core Module to shut the app down once app_offline.htm is in place. */
export const OFFLINE_WAIT_MS = 5000;

const SMOKE_PATH = fileURLToPath(new URL('./smoke.mjs', import.meta.url));
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA_MESSAGE = 'The commit sha must be 40 lowercase hex characters.';
const ACTIONS = Object.freeze(['deploy', 'online', 'hostprobe']);
const WEB_DEPLOY_PORT = 8172;
const SEPARATORS = /[,"';]/;
const MIN_PROBE_KEY_LENGTH = 32;
const BOM = String.fromCodePoint(0xfeff);
const PROBE_PROJECT = path.join(REPO_ROOT, 'tools', 'Csps.HostProbe');

/**
 * msdeploy parses `-dest:key=value,key=value` itself, so a separator inside a value would change the command (CWE-88).
 * @param {string} name
 * @param {string | undefined} value
 */
function assertPlain(name, value) {
  if (value === undefined || value === '') {
    throw new Error(`The Web Deploy ${name} is not set.`);
  }
  if (SEPARATORS.test(value)) {
    throw new Error(
      `The Web Deploy ${name} contains a character msdeploy cannot take (comma, quote or semicolon). Choose one without it.`,
    );
  }
  // A space would end the argument and let the rest read as another msdeploy option.
  if (/[\s\p{Cc}]/u.test(value)) {
    throw new Error(
      `The Web Deploy ${name} contains a space or control character msdeploy cannot take. Choose one without it.`,
    );
  }
}

/**
 * The `-dest:` value: the provider, the endpoint and the credentials. The error never contains the offending value.
 * @param {Connection & { contentPath?: string }} values
 * @returns {string}
 */
export function buildDestination({ server, site, userName, password, contentPath }) {
  assertPlain('server', server);
  assertPlain('site', site);
  assertPlain('user name', userName);
  assertPlain('password', password);
  return (
    `contentPath=${contentPath ?? site},computerName="https://${server}:${String(WEB_DEPLOY_PORT)}/msdeploy.axd?site=${site}",` +
    `userName=${userName},password=${password},authType=Basic,includeAcls=False`
  );
}

/** @param {string} value */
function quoteIfNeeded(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

/** @param {boolean} allowUntrusted @returns {string[]} */
function retryAndTrust(allowUntrusted) {
  return ['-retryAttempts:10', '-retryInterval:3000', ...(allowUntrusted ? ['-allowUntrusted'] : [])];
}

/**
 * The package sync. Stale files are deleted (no DoNotDeleteRule); the host's logs folder and app_offline.htm are skipped.
 * @param {{ sourceDir: string, destination: string, whatIf: boolean, allowUntrusted: boolean }} options
 * @returns {string[]}
 */
export function syncArgs({ sourceDir, destination, whatIf, allowUntrusted }) {
  return [
    '-verb:sync',
    `-source:contentPath=${quoteIfNeeded(sourceDir)}`,
    `-dest:${destination}`,
    '-skip:objectName=dirPath,absolutePath=\\\\logs$',
    '-skip:objectName=filePath,absolutePath=\\\\app_offline\\.htm$',
    '-retryAttempts:10',
    '-retryInterval:3000',
    ...(whatIf ? ['-whatif'] : []),
    ...(allowUntrusted ? ['-allowUntrusted'] : []),
  ];
}

/**
 * Puts the branded offline page on the site root.
 * @param {Connection & { allowUntrusted: boolean, appOfflinePath?: string }} options
 * @returns {string[]}
 */
export function offlineArgs({ allowUntrusted, appOfflinePath = APP_OFFLINE_PATH, ...connection }) {
  const destination = buildDestination({ ...connection, contentPath: `${connection.site}/app_offline.htm` });
  return [
    '-verb:sync',
    `-source:contentPath=${quoteIfNeeded(appOfflinePath)}`,
    `-dest:${destination}`,
    ...retryAndTrust(allowUntrusted),
  ];
}

/**
 * Takes the offline page down.
 * @param {Connection & { allowUntrusted: boolean }} options
 * @returns {string[]}
 */
export function onlineArgs({ allowUntrusted, ...connection }) {
  const destination = buildDestination({ ...connection, contentPath: `${connection.site}/app_offline.htm` });
  return ['-verb:delete', `-dest:${destination}`, ...retryAndTrust(allowUntrusted)];
}

/**
 * @param {string} text
 * @param {readonly (string | undefined)[]} secrets
 * @returns {string}
 */
export function redact(text, secrets) {
  let result = text;
  for (const secret of secrets) {
    if (secret !== undefined && secret !== '') {
      result = result.split(secret).join('***');
    }
  }
  return result;
}

/**
 * @param {Date} date
 * @param {string} sha
 * @returns {string}
 */
export function releaseTag(date, sha) {
  const stamp = date.toISOString().slice(0, 19).replaceAll(/\D/g, '');
  return `deploy-${stamp}-${sha.slice(0, 7)}`;
}

/**
 * Deploy releases that could be a rollback target, newest first: creation time descending, ties by tag name descending.
 * @param {readonly Release[]} releases
 * @returns {Release[]}
 */
function deployReleasesNewestFirst(releases) {
  return releases
    .filter((release) => !release.isDraft && RELEASE_PATTERN.test(release.tagName))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.tagName < b.tagName ? 1 : -1));
}

/**
 * The newest deploy release whose sha suffix differs from the sha being deployed, so a failed redeploy of the live build
 * never rolls back onto itself. Null on the first deploy.
 * @param {readonly Release[]} releases
 * @param {string} sha
 * @returns {Release | null}
 */
export function selectLastGood(releases, sha) {
  const suffix = `-${sha.slice(0, 7)}`;
  return deployReleasesNewestFirst(releases).find((release) => !release.tagName.endsWith(suffix)) ?? null;
}

/**
 * @param {string} name
 * @param {string} command
 * @param {readonly string[]} args
 * @returns {Step}
 */
function runStep(name, command, args) {
  return { name, kind: 'run', command, args, verbatim: command === MSDEPLOY_PATH };
}

/** @param {string} name @param {readonly string[]} args @returns {Step} */
function msdeployStep(name, args) {
  return runStep(name, MSDEPLOY_PATH, args);
}

/** @returns {Step} */
function waitStep() {
  return { name: 'wait', kind: 'wait', ms: OFFLINE_WAIT_MS };
}

/**
 * The smoke test as a child process of this Node; `probe` reads the one-time HostProbe instead (key from HOSTPROBE_KEY).
 * @param {DeployConfig} config
 * @param {boolean} [probe]
 * @returns {Step}
 */
function smokeStep({ origin }, probe = false) {
  return runStep('smoke', process.execPath, [SMOKE_PATH, ...(probe ? ['probe'] : []), '--origin', origin]);
}

/**
 * The offline, wait, sync, online part shared by the deploy, the rollback and the host probe.
 * @param {DeployConfig} config
 * @param {string} packageDir
 * @returns {Step[]}
 */
function swapSteps(config, packageDir) {
  const { connection, allowUntrusted } = config;
  return [
    msdeployStep('offline', offlineArgs({ ...connection, allowUntrusted })),
    waitStep(),
    msdeployStep(
      'sync',
      syncArgs({ sourceDir: packageDir, destination: buildDestination(connection), whatIf: false, allowUntrusted }),
    ),
    msdeployStep('online', onlineArgs({ ...connection, allowUntrusted })),
  ];
}

/**
 * Rollback to the last good release: the same offline, sync, online and smoke steps with that release's package.
 * @param {{ config: DeployConfig, lastGood: LastGood }} options
 * @returns {Step[]}
 */
export function planRollback({ config, lastGood }) {
  return [...swapSteps(config, lastGood.packageDir), smokeStep(config)];
}

/** @param {DeployConfig} config @param {string} packageDir @returns {Step} */
function releaseStep(config, packageDir) {
  const zip = path.join(config.workDir, 'site.zip');
  return {
    name: 'release',
    kind: 'sequence',
    tag: config.tag,
    commands: [
      { command: 'tar', args: ['-a', '-c', '-f', zip, '-C', packageDir, '.'] },
      {
        command: 'gh',
        args: [
          'release',
          'create',
          config.tag,
          zip,
          '--target',
          config.sha,
          '--title',
          config.tag,
          '--notes',
          `Deployed commit ${config.sha}.`,
          '--latest=false',
        ],
      },
    ],
  };
}

/**
 * The run as data. A dry run is one whatif sync; `online` only deletes app_offline.htm; `hostprobe` swaps in the probe and
 * reads it, with no release. The returned list carries `rollback`, the steps that restore `lastGood` (null when there is
 * none, as on the first deploy), and `onFailure`, what the executor does when a step fails.
 * @param {{ action: string, dryRun: boolean, packageDir: string | null, lastGood: LastGood | null, config: DeployConfig }} options
 * @returns {Plan}
 */
export function planDeploy({ action, dryRun, packageDir, lastGood, config }) {
  const { connection, allowUntrusted } = config;
  if (action === 'online') {
    return Object.assign([msdeployStep('online', onlineArgs({ ...connection, allowUntrusted }))], {
      rollback: null,
      onFailure: /** @type {OnFailure} */ ('none'),
    });
  }
  if (action !== 'deploy' && action !== 'hostprobe') {
    throw new Error(`The ${action} action is not available.`);
  }
  if (packageDir === null) {
    throw new Error('A deploy needs a package folder.');
  }
  if (dryRun) {
    const args = syncArgs({
      sourceDir: packageDir,
      destination: buildDestination(connection),
      whatIf: true,
      allowUntrusted,
    });
    return Object.assign([msdeployStep('sync', args)], {
      rollback: null,
      onFailure: /** @type {OnFailure} */ ('none'),
    });
  }
  if (action === 'hostprobe') {
    return Object.assign([...swapSteps(config, packageDir), smokeStep(config, true)], {
      rollback: null,
      onFailure: /** @type {OnFailure} */ ('offline'),
    });
  }
  const steps = [...swapSteps(config, packageDir), smokeStep(config), releaseStep(config, packageDir)];
  return Object.assign(steps, {
    rollback: lastGood === null ? null : { tag: lastGood.tag, steps: planRollback({ config, lastGood }) },
    onFailure: /** @type {OnFailure} */ ('rollback'),
  });
}

/**
 * @param {string | undefined} value
 * @returns {string}
 */
function normalizeFingerprint(value) {
  return (value ?? '').replaceAll(/[:\s]/g, '').toLowerCase();
}

/**
 * True when the server's leaf certificate SHA-256 equals the expected fingerprint (T-03-26). With nothing expected it is
 * false without connecting, so -allowUntrusted is never used.
 * @param {{ host: string, expected: string | undefined, connect: (host: string, port: number) => Promise<string> }} options
 * @returns {Promise<boolean>}
 */
export async function certificatePinOk({ host, expected, connect }) {
  const wanted = normalizeFingerprint(expected);
  if (wanted === '') {
    return false;
  }
  return normalizeFingerprint(await connect(host, WEB_DEPLOY_PORT)) === wanted;
}

/**
 * Reads the SHA-256 fingerprint of the server's leaf certificate without trusting it; only the pin decides.
 * @param {string} host
 * @param {number} port
 * @returns {Promise<string>}
 */
function connectTls(host, port) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port, servername: net.isIP(host) === 0 ? host : '', rejectUnauthorized: false, timeout: 15_000 },
      () => {
        const fingerprint = socket.getPeerCertificate().fingerprint256;
        socket.end();
        resolve(fingerprint);
      },
    );
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('timed out'));
    });
    socket.once('error', reject);
  });
}

/**
 * @param {Spawn} run
 * @returns {Release[]}
 */
function listReleases(run) {
  const listed = run('gh', ['release', 'list', '--json', 'tagName,createdAt,isDraft', '--limit', '100'], {});
  if (listed.status !== 0) {
    throw new Error('gh could not list the releases.');
  }
  return /** @type {Release[]} */ (parseJson(listed.stdout));
}

/**
 * @param {string | undefined} text
 * @returns {unknown}
 */
function parseJson(text) {
  return JSON.parse(text ?? '[]');
}

/**
 * Downloads a deploy release's site.zip and unpacks it to <dir>/site with the Windows built-in tar.
 * @param {{ run: Spawn, mkdir: (dir: string) => void }} deps
 * @param {string} tag
 * @param {string} dir
 * @returns {string} the package folder.
 */
function downloadRelease({ run, mkdir }, tag, dir) {
  mkdir(dir);
  if (run('gh', ['release', 'download', tag, '-p', 'site.zip', '-D', dir], {}).status !== 0) {
    throw new Error(`The release ${tag} could not be downloaded.`);
  }
  const siteDir = path.join(dir, 'site');
  mkdir(siteDir);
  if (run('tar', ['-x', '-f', path.join(dir, 'site.zip'), '-C', siteDir], {}).status !== 0) {
    throw new Error(`The package of the release ${tag} could not be unpacked.`);
  }
  return siteDir;
}

/**
 * The package for a sha: the csps-package-<sha> artifact of a successful push run of ci.yml on main for exactly that
 * commit, else the existing deploy release for that sha (a manual rollback beyond the 14-day artifact retention).
 * Anything else is refused (T-03-28).
 * @param {string} sha
 * @param {{ run: Spawn, dir: string, mkdir: (dir: string) => void, exists: (file: string) => boolean }} deps
 * @returns {Promise<{ source: 'artifact' | 'release', packageDir: string }>}
 */
export function findPackage(sha, deps) {
  if (!SHA_PATTERN.test(sha)) {
    return Promise.reject(new Error(SHA_MESSAGE));
  }
  const { run, dir, exists } = deps;
  const siteDir = path.join(dir, 'site');
  const listed = run(
    'gh',
    [
      'run',
      'list',
      '--workflow',
      'ci.yml',
      '--branch',
      'main',
      '--commit',
      sha,
      '--status',
      'success',
      '--json',
      'databaseId,event,headSha',
    ],
    {},
  );
  if (listed.status !== 0) {
    return Promise.reject(new Error(`gh could not list the CI runs for ${sha.slice(0, 7)}.`));
  }
  const runs = /** @type {{ databaseId: number, event: string, headSha: string }[]} */ (parseJson(listed.stdout));
  const ci = runs.find((candidate) => candidate.event === 'push' && candidate.headSha === sha);
  if (ci !== undefined) {
    const downloaded = run(
      'gh',
      ['run', 'download', String(ci.databaseId), '-n', `csps-package-${sha}`, '-D', dir],
      {},
    );
    if (downloaded.status === 0 && exists(siteDir)) {
      return Promise.resolve({ source: 'artifact', packageDir: siteDir });
    }
  }
  const suffix = `-${sha.slice(0, 7)}`;
  const release = deployReleasesNewestFirst(listReleases(run)).find((candidate) => candidate.tagName.endsWith(suffix));
  if (release === undefined) {
    return Promise.reject(new Error(`No CI-passed build or deploy release exists for ${sha.slice(0, 7)}.`));
  }
  return Promise.resolve({ source: 'release', packageDir: downloadRelease(deps, release.tagName, dir) });
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @returns {string}
 */
function describeCommand(command, args) {
  return [command === MSDEPLOY_PATH ? 'msdeploy' : command, ...args].join(' ');
}

/**
 * Runs one command, logging the redacted command line and the redacted output.
 * @param {Command & { verbatim?: boolean, cwd?: string }} command
 * @param {ExecuteDeps} deps
 * @returns {boolean}
 */
function runCommand({ command, args, verbatim = false, cwd }, { spawn, log, secrets }) {
  log(`> ${redact(describeCommand(command, args), secrets)}`);
  /** @type {SpawnOptions} */
  const options = {};
  if (cwd !== undefined) {
    options.cwd = cwd;
  }
  if (verbatim) {
    // Verbatim arguments keep msdeploy's own quoting; the program name must then be quoted by hand when it has spaces.
    options.windowsVerbatimArguments = true;
    if (/\s/.test(command)) {
      options.argv0 = `"${command}"`;
    }
  }
  try {
    const result = spawn(command, args, options);
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (output !== '') {
      log(redact(output, secrets));
    }
    return result.status === 0;
  } catch (error) {
    log(redact(error instanceof Error ? error.message : String(error), secrets));
    return false;
  }
}

/**
 * @param {Step} step
 * @param {ExecuteDeps} deps
 * @returns {Promise<boolean>}
 */
async function runStepOf(step, deps) {
  if (step.kind === 'wait') {
    deps.log(`> wait ${String(step.ms ?? 0)} ms`);
    await deps.sleep(step.ms ?? 0);
    return true;
  }
  const commands =
    step.kind === 'sequence' ? (step.commands ?? []) : [{ command: step.command ?? '', args: step.args ?? [] }];
  for (const command of commands) {
    if (!runCommand({ ...command, verbatim: step.verbatim === true }, deps)) {
      return false;
    }
  }
  return true;
}

const KIT = 'Use the D-05 legacy rollback kit (docs/operations/deploy.md).';

const URL_COMPRESSION = '<urlCompression doStaticCompression="false" doDynamicCompression="false" />';
const HTTPS_REWRITE =
  '<rewrite><rules><rule name="HttpToHttps" stopProcessing="true"><match url="(.*)" />' +
  '<conditions><add input="{HTTPS}" pattern="^OFF$" /></conditions>' +
  '<action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" /></rule></rules></rewrite>';

/**
 * The probe's web.config with IIS compression off (the setting CSPS ships, so the probe shows whether the host accepts
 * it) and, when asked, one HTTP-to-HTTPS rewrite rule (shows whether URL Rewrite exists). An existing urlCompression is
 * replaced, because a second one is a 500.19.
 * @param {string} xml
 * @param {{ rewrite: boolean }} options
 * @returns {string}
 */
export function injectProbeWebConfig(xml, { rewrite }) {
  const opening = /<system\.webServer(?:\s[^>]*[^/>])?>/;
  if (!opening.test(xml)) {
    throw new Error('The probe web.config has no system.webServer element.');
  }
  const additions = `${URL_COMPRESSION}${rewrite ? HTTPS_REWRITE : ''}`;
  return xml.replaceAll(/<urlCompression\b[^>]*\/>/g, '').replace(opening, (tag) => `${tag}${additions}`);
}

/**
 * The probe's appsettings.json with HostProbe.Key set and every other setting kept.
 * @param {string} json
 * @param {string} key
 * @returns {string}
 */
export function withProbeKey(json, key) {
  const settings = /** @type {Record<string, unknown>} */ (parseJson(json.startsWith(BOM) ? json.slice(1) : json));
  const section = /** @type {Record<string, unknown>} */ (settings.HostProbe ?? {});
  return `${JSON.stringify({ ...settings, HostProbe: { ...section, Key: key } }, null, 2)}\n`;
}

/**
 * Runs the planned steps in order. On a failure the plan's `onFailure` decides: `rollback` restores the last good release
 * (D-13) or, with none, puts the branded offline page back (first deploy); `offline` puts the page back (host probe);
 * `none` just reports (dry run, online). A failed release step leaves the live, smoke-tested site alone.
 * @param {Plan} steps
 * @param {ExecuteDeps} deps
 * @returns {Promise<DeployResult>}
 */
export async function executeDeploy(steps, deps) {
  /** @type {DeployResult} */
  const result = { exitCode: 0, results: [], messages: [] };
  const state = { offlineUp: false };

  /**
   * @param {readonly Step[]} list
   * @param {string} prefix
   * @returns {Promise<Step | null>} the step that failed, or null when all passed.
   */
  const runAll = async (list, prefix) => {
    for (const step of list) {
      const ok = await runStepOf(step, deps);
      result.results.push({ name: `${prefix}${step.name}`, ok });
      if (step.name === 'offline') {
        state.offlineUp = true;
      } else if (step.name === 'online' && ok) {
        state.offlineUp = false;
      }
      if (!ok) {
        return step;
      }
    }
    return null;
  };
  const offlineStep = steps.find((step) => step.name === 'offline');
  const onlineStep = steps.find((step) => step.name === 'online');
  const putOfflineBack = async () => {
    if (offlineStep !== undefined) {
      await runAll([offlineStep], 'restore ');
    }
  };

  try {
    const failed = await runAll(steps, '');
    if (failed === null) {
      const released = steps.find((step) => step.tag !== undefined)?.tag;
      if (released !== undefined) {
        result.releaseTag = released;
      }
      return result;
    }
    result.exitCode = 1;
    const failure = `The ${failed.name} step failed.`;
    if (failed.name === 'release') {
      result.messages.push(
        `${failure} The site is live and passed the smoke test, but no release was created, so it cannot be rolled back to later. Run the deploy again for the same commit.`,
      );
    } else if (steps.onFailure === 'none' || offlineStep === undefined) {
      result.messages.push(failure);
    } else if (failed.name === 'offline') {
      // Nothing else ran, so the site is as it was; clear any half-uploaded page.
      if (onlineStep !== undefined) {
        await runAll([onlineStep], 'cleanup ');
      }
      result.messages.push(`${failure} The site was not changed.`);
    } else if (steps.onFailure === 'offline') {
      await putOfflineBack();
      result.messages.push(`${failure} The branded offline page is up.`);
    } else if (steps.rollback === null) {
      await putOfflineBack();
      result.messages.push(
        `${failure} No earlier release exists to roll back to. The branded offline page is up. ${KIT}`,
      );
    } else {
      const { tag } = steps.rollback;
      const rollbackFailed = await runAll(steps.rollback.steps, 'rollback ');
      if (rollbackFailed === null) {
        result.messages.push(`${failure} Rolled back to ${tag}.`);
      } else {
        await putOfflineBack();
        result.messages.push(
          `${failure} The rollback to ${tag} failed too (${rollbackFailed.name}). The branded offline page is up. ${KIT}`,
        );
      }
    }
    return result;
  } finally {
    // A clean run must never end with app_offline.htm on the site.
    if (state.offlineUp && result.exitCode === 0) {
      result.exitCode = 1;
      result.messages.push('app_offline.htm may still be on the site.');
      if (onlineStep !== undefined) {
        await runAll([onlineStep], 'cleanup ');
      }
    }
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} name
 * @returns {string}
 */
function required(env, name) {
  const value = env[name]?.trim();
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

/**
 * The probe key comes from a secret and is never trimmed, logged or passed as an argument (T-03-30).
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
function requireProbeKey(env) {
  const key = env.HOSTPROBE_KEY ?? '';
  if (key.trim() === '') {
    throw new Error('HOSTPROBE_KEY is not set.');
  }
  if (key.length < MIN_PROBE_KEY_LENGTH) {
    throw new Error(`HOSTPROBE_KEY must be at least ${String(MIN_PROBE_KEY_LENGTH)} characters.`);
  }
  return key;
}

/**
 * Publishes the HostProbe into the runner's temp folder and sets its key and web.config there; the files under tools/
 * are never edited, so no key can reach git.
 * @param {MainDeps} deps
 * @param {ExecuteDeps} executeDeps
 * @param {{ workDir: string, key: string, rewrite: boolean }} options
 * @returns {string} the folder to sync.
 */
function prepareProbe(deps, executeDeps, { workDir, key, rewrite }) {
  const probeDir = path.join(workDir, 'probe');
  deps.mkdir(workDir);
  const args = ['publish', PROBE_PROJECT, '-c', 'Release', '-o', probeDir];
  if (!runCommand({ command: 'dotnet', args, cwd: REPO_ROOT }, executeDeps)) {
    throw new Error('The host probe could not be published.');
  }
  const settingsFile = path.join(probeDir, 'appsettings.json');
  const configFile = path.join(probeDir, 'web.config');
  if (!deps.exists(configFile)) {
    throw new Error('The published probe has no web.config.');
  }
  deps.writeFile(settingsFile, withProbeKey(deps.readFile(settingsFile), key));
  deps.writeFile(configFile, injectProbeWebConfig(deps.readFile(configFile), { rewrite }));
  return probeDir;
}

/**
 * @param {string} action
 * @param {string} sha7
 * @param {DeployResult} result
 * @returns {string}
 */
function summaryMarkdown(action, sha7, result) {
  const rows = result.results.map((row) => `| ${row.name} | ${row.ok ? 'pass' : 'FAIL'} |`);
  return [
    `## Web Deploy: ${action} ${sha7}`,
    '',
    '| Step | Result |',
    '| --- | --- |',
    ...rows,
    '',
    ...(result.releaseTag === undefined ? [] : [`Release: \`${result.releaseTag}\``, '']),
    ...result.messages,
    '',
  ].join('\n');
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {MainDeps} deps
 * @param {readonly string[]} argv
 * @param {(text: string) => void} log
 * @returns {Promise<number>}
 */
async function run(env, deps, argv, log) {
  const action = env.INPUT_ACTION?.trim() ?? '';
  if (!ACTIONS.includes(action)) {
    throw new Error('INPUT_ACTION must be deploy, online or hostprobe.');
  }
  const planOnly = argv.includes('--plan');
  const connection = {
    server: required(env, 'WEBDEPLOY_SERVER'),
    site: required(env, 'WEBDEPLOY_SITE'),
    userName: required(env, 'WEBDEPLOY_USERNAME'),
    password: required(env, 'WEBDEPLOY_PASSWORD'),
  };
  buildDestination(connection);
  const sha = env.INPUT_SHA?.trim() ?? '';
  if (action === 'deploy' && !SHA_PATTERN.test(sha)) {
    throw new Error(SHA_MESSAGE);
  }
  const probeKey = action === 'hostprobe' ? requireProbeKey(env) : '';
  const origin = action === 'online' ? '' : new URL(required(env, 'SITE_ORIGIN')).origin;
  const dryRun = env.INPUT_DRY_RUN?.trim() === 'true';
  const workDir = path.join(env.RUNNER_TEMP ?? os.tmpdir(), 'csps-deploy');
  const packageDir = action === 'hostprobe' ? path.join(workDir, 'probe') : path.join(workDir, 'package', 'site');
  const base = {
    connection,
    allowUntrusted: false,
    origin,
    sha,
    tag: releaseTag(deps.now(), sha || '0'.repeat(7)),
    workDir,
  };

  if (planOnly) {
    const lastGood = { tag: 'deploy-<newest earlier release>', packageDir: path.join(workDir, 'last-good', 'site') };
    const plan = planDeploy({ action, dryRun, packageDir, lastGood, config: base });
    log(`Plan for ${action}${dryRun ? ' (dry run)' : ''}:`);
    plan.forEach((step, index) => {
      log(`${String(index + 1)}. ${step.name}: ${describeStep(step)}`);
    });
    if (plan.rollback !== null) {
      log(`If the sync or the smoke test fails, roll back to ${plan.rollback.tag}:`);
      plan.rollback.steps.forEach((step, index) => {
        log(`  ${String(index + 1)}. ${step.name}: ${describeStep(step)}`);
      });
    }
    return 0;
  }

  if (!deps.exists(MSDEPLOY_PATH)) {
    throw new Error(
      `msdeploy.exe was not found at ${MSDEPLOY_PATH}. The windows-2025 image should include Web Deploy.`,
    );
  }
  const pin = env.WEBDEPLOY_CERT_SHA256?.trim() ?? '';
  let allowUntrusted = false;
  if (pin !== '') {
    try {
      allowUntrusted = await certificatePinOk({ host: connection.server, expected: pin, connect: deps.connectTls });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not read the certificate of ${connection.server} on port ${String(WEB_DEPLOY_PORT)}: ${reason}`,
        { cause: error },
      );
    }
    if (!allowUntrusted) {
      throw new Error(
        `The server certificate of ${connection.server} does not match WEBDEPLOY_CERT_SHA256. Nothing was deployed. If the host renewed its certificate, update the secret.`,
      );
    }
  }
  const config = { ...base, allowUntrusted };
  /** @type {ExecuteDeps} */
  const executeDeps = {
    spawn: deps.spawn,
    sleep: deps.sleep,
    log,
    secrets: [connection.password, env.HOSTPROBE_KEY, env.GH_TOKEN],
  };

  /** @type {Plan} */
  let plan;
  if (action === 'online') {
    plan = planDeploy({ action, dryRun, packageDir: null, lastGood: null, config });
  } else if (action === 'hostprobe') {
    const rewrite = env.INPUT_PROBE_REWRITE?.trim() === 'true';
    const probeDir = prepareProbe(deps, executeDeps, { workDir, key: probeKey, rewrite });
    plan = planDeploy({ action, dryRun, packageDir: probeDir, lastGood: null, config });
  } else {
    deps.mkdir(path.join(workDir, 'package'));
    const found = await findPackage(sha, {
      run: deps.spawn,
      dir: path.join(workDir, 'package'),
      mkdir: deps.mkdir,
      exists: deps.exists,
    });
    /** @type {LastGood | null} */
    let lastGood = null;
    if (!dryRun) {
      const release = selectLastGood(listReleases(deps.spawn), sha);
      if (release !== null) {
        lastGood = {
          tag: release.tagName,
          packageDir: downloadRelease(
            { run: deps.spawn, mkdir: deps.mkdir },
            release.tagName,
            path.join(workDir, 'last-good'),
          ),
        };
      }
    }
    plan = planDeploy({ action, dryRun, packageDir: found.packageDir, lastGood, config });
  }
  const result = await executeDeploy(plan, executeDeps);
  const summaryFile = env.GITHUB_STEP_SUMMARY;
  if (summaryFile !== undefined && summaryFile !== '') {
    deps.appendFile(summaryFile, summaryMarkdown(action, sha.slice(0, 7), result));
  }
  return result.exitCode;
}

/**
 * @param {Step} step
 * @returns {string}
 */
function describeStep(step) {
  if (step.kind === 'wait') {
    return `wait ${String(step.ms ?? 0)} ms`;
  }
  const commands =
    step.kind === 'sequence' ? (step.commands ?? []) : [{ command: step.command ?? '', args: step.args ?? [] }];
  return commands.map((command) => describeCommand(command.command, command.args)).join(' && ');
}

/**
 * The CLI body: returns the exit code and never throws, so a refusal reads as one plain line.
 * @param {Record<string, string | undefined>} env
 * @param {MainDeps} deps
 * @param {readonly string[]} argv
 * @returns {Promise<number>}
 */
export async function main(env, deps, argv) {
  const secrets = [env.WEBDEPLOY_PASSWORD, env.HOSTPROBE_KEY, env.GH_TOKEN];
  /** @param {string} text */
  const log = (text) => {
    deps.log(redact(text, secrets));
  };
  try {
    return await run(env, deps, argv, log);
  } catch (error) {
    log(`deploy: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/** @returns {MainDeps} */
function defaultDeps() {
  return {
    spawn: (command, args, options) => {
      const result = spawnSync(command, [...args], {
        ...options,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      });
      return { status: result.status, stdout: result.stdout, stderr: `${result.stderr}${result.error?.message ?? ''}` };
    },
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
    now: () => new Date(),
    log: (text) => {
      process.stdout.write(`${text}\n`);
    },
    exists: existsSync,
    mkdir: (dir) => {
      mkdirSync(dir, { recursive: true });
    },
    appendFile: appendFileSync,
    connectTls,
    readFile: (file) => readFileSync(file, 'utf8'),
    writeFile: (file, text) => {
      writeFileSync(file, text, 'utf8');
    },
  };
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.env, defaultDeps(), process.argv.slice(2));
}
