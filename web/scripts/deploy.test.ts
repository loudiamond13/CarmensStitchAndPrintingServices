// @vitest-environment node
// Pins the Web Deploy orchestrator (OPS-04, D-11, D-12, D-13). Every case drives deploy.mjs through a fake spawn, a fake
// clock and a fake filesystem, so no msdeploy, gh or tar process starts and nothing reaches a host. The password and
// the probe key must never appear in any logged line, even when a fake tool echoes them (T-03-25, T-03-30).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APP_OFFLINE_PATH,
  buildDestination,
  certificatePinOk,
  executeDeploy,
  findPackage,
  injectProbeWebConfig,
  main,
  MSDEPLOY_PATH,
  OFFLINE_WAIT_MS,
  offlineArgs,
  onlineArgs,
  planDeploy,
  planRollback,
  redact,
  releaseTag,
  selectLastGood,
  syncArgs,
  withProbeKey,
} from './deploy.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const SHA7 = '0123456';
const PASSWORD = 'Sup3rSecretPw';
const CONNECTION = { server: 'host.example', site: 'site1', userName: 'deployer', password: PASSWORD };
const ORIGIN = 'https://example.invalid';
const NOW = new Date('2026-10-20T03:04:05Z');
const TAG = 'deploy-20261020030405-0123456';
const PACKAGE_DIR = '/work/csps-deploy/package/site';
const LAST_GOOD_DIR = '/work/csps-deploy/last-good/site';
const LAST_GOOD = { tag: 'deploy-20261019010101-aaaaaaa', packageDir: LAST_GOOD_DIR };
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const CONFIG = {
  connection: CONNECTION,
  allowUntrusted: false,
  origin: ORIGIN,
  sha: SHA,
  tag: TAG,
  workDir: '/work/csps-deploy',
};

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: { readonly windowsVerbatimArguments?: boolean; readonly argv0?: string };
}

/** The step a recorded call belongs to, so a test can script "the second smoke fails". */
function label(call: Call): string {
  const text = call.args.join(' ');
  if (call.command === MSDEPLOY_PATH) {
    const source = call.args.find((arg) => arg.startsWith('-source:')) ?? '';
    if (text.includes('-verb:delete')) {
      return 'online';
    }
    if (text.includes('-whatif')) {
      return 'whatif';
    }
    if (source.includes('app_offline.htm')) {
      return 'offline';
    }
    return source.includes('last-good') ? 'sync-last-good' : 'sync';
  }
  if (call.command === process.execPath) {
    return text.includes(' probe ') || text.includes('smoke.mjs probe') ? 'smoke-probe' : 'smoke';
  }
  if (call.command === 'dotnet') {
    return 'dotnet publish';
  }
  if (call.command === 'tar') {
    return text.includes('-c') ? 'zip' : 'unzip';
  }
  if (call.command === 'gh') {
    return `gh ${call.args.slice(0, 2).join(' ')}`;
  }
  return call.command;
}

interface World {
  readonly calls: Call[];
  readonly logged: string[];
  readonly sleeps: number[];
  readonly summary: string[];
  readonly made: string[];
  readonly labels: () => string[];
  readonly deps: {
    readonly spawn: (command: string, args: readonly string[], options: Call['options']) => FakeResult;
    readonly sleep: (ms: number) => Promise<void>;
    readonly now: () => Date;
    readonly log: (text: string) => void;
    readonly exists: (file: string) => boolean;
    readonly mkdir: (dir: string) => void;
    readonly appendFile: (file: string, text: string) => void;
    readonly connectTls: (host: string, port: number) => Promise<string>;
    readonly readFile: (file: string) => string;
    readonly writeFile: (file: string, text: string) => void;
  };
  /** Files by base name, as read and written by the host probe preparation. */
  readonly files: Map<string, string>;
}

interface FakeResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * A fake machine. `script` maps a step label to the exit statuses of its successive calls (missing means 0);
 * `stdout` maps a label to the text the fake tool prints.
 */
function fakeWorld(
  script: Readonly<Record<string, readonly number[]>> = {},
  stdout: Readonly<Record<string, string>> = {},
  initialFiles: Readonly<Record<string, string>> = {},
): World {
  const files = new Map<string, string>(Object.entries(initialFiles));
  const calls: Call[] = [];
  const logged: string[] = [];
  const sleeps: number[] = [];
  const summary: string[] = [];
  const made: string[] = [];
  const counts = new Map<string, number>();
  const world: World = {
    calls,
    logged,
    sleeps,
    summary,
    made,
    files,
    labels: () => calls.map(label),
    deps: {
      spawn: (command, args, options) => {
        const call = { command, args, options };
        calls.push(call);
        const name = label(call);
        const index = counts.get(name) ?? 0;
        counts.set(name, index + 1);
        const statuses = script[name] ?? [];
        return {
          status: statuses[index] ?? statuses[statuses.length - 1] ?? 0,
          stdout: stdout[name] ?? '',
          stderr: '',
        };
      },
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      now: () => NOW,
      log: (text) => {
        logged.push(text);
      },
      exists: () => true,
      mkdir: (dir) => {
        made.push(dir);
      },
      appendFile: (_file, text) => {
        summary.push(text);
      },
      connectTls: () => Promise.resolve('AA:BB'),
      readFile: (file) => files.get(path.basename(file)) ?? '',
      writeFile: (file, text) => {
        files.set(path.basename(file), text);
      },
    },
  };
  return world;
}

function everythingLogged(world: World): string {
  return [...world.logged, ...world.summary].join('\n');
}

describe('buildDestination', () => {
  it('builds the contentPath, computerName and credentials string msdeploy takes', () => {
    expect(buildDestination(CONNECTION)).toBe(
      `contentPath=site1,computerName="https://host.example:8172/msdeploy.axd?site=site1",userName=deployer,password=${PASSWORD},authType=Basic,includeAcls=False`,
    );
  });

  it('points the contentPath at one file when asked', () => {
    expect(buildDestination({ ...CONNECTION, contentPath: 'site1/app_offline.htm' })).toContain(
      'contentPath=site1/app_offline.htm,computerName=',
    );
  });

  it.each([
    ['server', ','],
    ['server', '"'],
    ['site', "'"],
    ['user name', ';'],
    ['password', ','],
    ['password', '"'],
    ['password', "'"],
    ['password', ';'],
  ])('refuses a %s holding %j without echoing it', (name, bad) => {
    const values = { ...CONNECTION, [name === 'user name' ? 'userName' : name]: `ab${bad}cd` };

    let message = '';
    try {
      buildDestination(values);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe(
      `The Web Deploy ${name} contains a character msdeploy cannot take (comma, quote or semicolon). Choose one without it.`,
    );
    expect(message).not.toContain(`ab${bad}cd`);
  });

  it('refuses an empty value by name', () => {
    expect(() => buildDestination({ ...CONNECTION, password: '' })).toThrow('The Web Deploy password is not set.');
  });
});

describe('syncArgs', () => {
  const destination = buildDestination(CONNECTION);

  it('syncs the package, skips the host logs folder and app_offline.htm, and retries 10 times every 3 seconds', () => {
    const args = syncArgs({ sourceDir: PACKAGE_DIR, destination, whatIf: false, allowUntrusted: false });

    expect(args).toEqual([
      '-verb:sync',
      `-source:contentPath=${PACKAGE_DIR}`,
      `-dest:${destination}`,
      '-skip:objectName=dirPath,absolutePath=\\\\logs$',
      '-skip:objectName=filePath,absolutePath=\\\\app_offline\\.htm$',
      '-retryAttempts:10',
      '-retryInterval:3000',
    ]);
  });

  it('adds -whatif and -allowUntrusted only when asked, and never an -enableRule', () => {
    const plain = syncArgs({ sourceDir: PACKAGE_DIR, destination, whatIf: false, allowUntrusted: false });
    const both = syncArgs({ sourceDir: PACKAGE_DIR, destination, whatIf: true, allowUntrusted: true });

    expect(plain).not.toContain('-whatif');
    expect(plain).not.toContain('-allowUntrusted');
    expect(both).toContain('-whatif');
    expect(both).toContain('-allowUntrusted');
    expect([...plain, ...both].some((arg) => arg.startsWith('-enableRule:'))).toBe(false);
  });

  it('quotes a source folder that holds a space', () => {
    const args = syncArgs({ sourceDir: 'C:\\a b\\site', destination, whatIf: false, allowUntrusted: false });

    expect(args[1]).toBe('-source:contentPath="C:\\a b\\site"');
  });
});

describe('offlineArgs and onlineArgs', () => {
  it('sync the branded app_offline.htm from tools/deploy to the site root file', () => {
    const args = offlineArgs({ ...CONNECTION, allowUntrusted: false });

    expect(path.isAbsolute(APP_OFFLINE_PATH)).toBe(true);
    expect(path.relative(repoRoot, APP_OFFLINE_PATH).replaceAll('\\', '/')).toBe('tools/deploy/app_offline.htm');
    expect(args[0]).toBe('-verb:sync');
    expect(args[1]).toBe(`-source:contentPath=${APP_OFFLINE_PATH}`);
    expect(args[2]).toContain('-dest:contentPath=site1/app_offline.htm,computerName=');
    expect(args.some((arg) => arg.startsWith('-skip:'))).toBe(false);
  });

  it('delete app_offline.htm from the site root', () => {
    const args = onlineArgs({ ...CONNECTION, allowUntrusted: true });

    expect(args[0]).toBe('-verb:delete');
    expect(args[1]).toContain('-dest:contentPath=site1/app_offline.htm,computerName=');
    expect(args).toContain('-allowUntrusted');
  });
});

describe('redact', () => {
  it('replaces every occurrence of each secret with ***', () => {
    expect(redact(`a ${PASSWORD} b ${PASSWORD} k1`, [PASSWORD, 'k1'])).toBe('a *** b *** ***');
  });

  it('ignores empty secrets and leaves other text alone', () => {
    expect(redact('nothing here', ['', undefined])).toBe('nothing here');
  });
});

describe('releaseTag and selectLastGood', () => {
  it('names a release from the UTC time to the second and the first 7 characters of the sha', () => {
    expect(releaseTag(NOW, SHA)).toBe(TAG);
  });

  const release = (tagName: string, createdAt: string, isDraft = false) => ({ tagName, createdAt, isDraft });

  it('picks the newest release whose sha suffix differs from the sha being deployed', () => {
    const releases = [
      release('deploy-20261020030405-0123456', '2026-10-20T03:04:10Z'),
      release('deploy-20261019010101-aaaaaaa', '2026-10-19T01:01:05Z'),
      release('deploy-20261018010101-bbbbbbb', '2026-10-18T01:01:05Z'),
    ];

    expect(selectLastGood(releases, SHA)?.tagName).toBe('deploy-20261019010101-aaaaaaa');
  });

  it('breaks a creation-time tie by tag name, descending', () => {
    const releases = [
      release('deploy-20261019010101-aaaaaaa', '2026-10-19T01:01:05Z'),
      release('deploy-20261019010102-bbbbbbb', '2026-10-19T01:01:05Z'),
    ];

    expect(selectLastGood(releases, SHA)?.tagName).toBe('deploy-20261019010102-bbbbbbb');
  });

  it('ignores drafts and tags that are not deploy releases', () => {
    const releases = [
      release('deploy-20261019010101-aaaaaaa', '2026-10-19T01:01:05Z', true),
      release('v1.0.0', '2026-10-19T02:00:00Z'),
      release('deploy-2026-aaaaaaa', '2026-10-19T03:00:00Z'),
      release('deploy-20261019010101-AAAAAAA', '2026-10-19T03:00:00Z'),
    ];

    expect(selectLastGood(releases, SHA)).toBeNull();
  });

  it('returns null when there is no release at all (the first deploy)', () => {
    expect(selectLastGood([], SHA)).toBeNull();
  });
});

describe('planDeploy', () => {
  const names = (steps: readonly { readonly name: string }[]) => steps.map((step) => step.name);

  it('is offline, wait 5 seconds, sync the package, online, smoke, release', () => {
    const steps = planDeploy({
      action: 'deploy',
      dryRun: false,
      packageDir: PACKAGE_DIR,
      lastGood: null,
      config: CONFIG,
    });

    expect(names(steps)).toEqual(['offline', 'wait', 'sync', 'online', 'smoke', 'release']);
    expect(OFFLINE_WAIT_MS).toBe(5000);
    expect(steps[1]?.ms).toBe(5000);
    expect(steps[2]?.args?.[1]).toBe(`-source:contentPath=${PACKAGE_DIR}`);
  });

  it('runs the smoke test as a child process of this Node against the site origin', () => {
    const smoke = planDeploy({
      action: 'deploy',
      dryRun: false,
      packageDir: PACKAGE_DIR,
      lastGood: null,
      config: CONFIG,
    })[4];

    expect(smoke?.command).toBe(process.execPath);
    expect(smoke?.args?.map((arg) => arg.replaceAll('\\', '/')).join(' ')).toMatch(
      /scripts\/smoke\.mjs --origin https:\/\/example\.invalid$/,
    );
  });

  it('zips the package and creates the release with its tag, the target sha and --latest=false', () => {
    const release = planDeploy({
      action: 'deploy',
      dryRun: false,
      packageDir: PACKAGE_DIR,
      lastGood: null,
      config: CONFIG,
    })[5];

    expect(release?.commands?.map((command) => command.command)).toEqual(['tar', 'gh']);
    const gh = release?.commands?.[1]?.args ?? [];
    expect(gh.slice(0, 3)).toEqual(['release', 'create', TAG]);
    expect(gh).toContain('--latest=false');
    expect(gh[gh.indexOf('--target') + 1]).toBe(SHA);
  });

  it('is exactly one whatif sync on a dry run', () => {
    const steps = planDeploy({
      action: 'deploy',
      dryRun: true,
      packageDir: PACKAGE_DIR,
      lastGood: LAST_GOOD,
      config: CONFIG,
    });

    expect(names(steps)).toEqual(['sync']);
    expect(steps[0]?.args).toContain('-whatif');
  });

  it('is exactly one msdeploy delete for the online action', () => {
    const steps = planDeploy({ action: 'online', dryRun: false, packageDir: null, lastGood: null, config: CONFIG });

    expect(names(steps)).toEqual(['online']);
    expect(steps[0]?.args?.[0]).toBe('-verb:delete');
  });

  it('spawns msdeploy with verbatim arguments and a quoted program name', () => {
    const sync = planDeploy({
      action: 'deploy',
      dryRun: false,
      packageDir: PACKAGE_DIR,
      lastGood: null,
      config: CONFIG,
    })[2];

    expect(sync?.command).toBe(MSDEPLOY_PATH);
    expect(sync?.verbatim).toBe(true);
  });

  it('plans the rollback as offline, wait, sync of the last good package, online, smoke', () => {
    const steps = planRollback({ config: CONFIG, lastGood: LAST_GOOD });

    expect(names(steps)).toEqual(['offline', 'wait', 'sync', 'online', 'smoke']);
    expect(steps[2]?.args?.[1]).toBe(`-source:contentPath=${LAST_GOOD_DIR}`);
  });
});

describe('certificatePinOk', () => {
  it('is true when the normalized fingerprints match', async () => {
    const connect = () => Promise.resolve('AB:CD:EF');

    await expect(certificatePinOk({ host: 'h', expected: 'ab cd ef'.replaceAll(' ', ':'), connect })).resolves.toBe(
      true,
    );
    await expect(certificatePinOk({ host: 'h', expected: 'abcdef', connect })).resolves.toBe(true);
  });

  it('is false on a mismatch', async () => {
    await expect(
      certificatePinOk({ host: 'h', expected: 'abcd', connect: () => Promise.resolve('AB:CD:EF') }),
    ).resolves.toBe(false);
  });

  it('is false, without connecting, when no fingerprint is set', async () => {
    let connected = false;
    const connect = () => {
      connected = true;
      return Promise.resolve('AB');
    };

    await expect(certificatePinOk({ host: 'h', expected: undefined, connect })).resolves.toBe(false);
    await expect(certificatePinOk({ host: 'h', expected: '  ', connect })).resolves.toBe(false);
    expect(connected).toBe(false);
  });
});

describe('findPackage', () => {
  function ghWorld(runs: unknown, releases: unknown, script: Readonly<Record<string, readonly number[]>> = {}) {
    return fakeWorld(script, {
      'gh run list': JSON.stringify(runs),
      'gh release list': JSON.stringify(releases),
    });
  }
  const runOf = (event: string, headSha = SHA) => ({ databaseId: 42, event, headSha });

  it('downloads the csps-package-<sha> artifact of a successful push run', async () => {
    const world = ghWorld([runOf('push')], []);

    const found = await findPackage(SHA, { ...world.deps, run: world.deps.spawn, dir: '/work/pkg' });

    expect(found).toEqual({ source: 'artifact', packageDir: path.join('/work/pkg', 'site') });
    const download = world.calls.find((call) => label(call) === 'gh run download');
    expect(download?.args).toEqual(['run', 'download', '42', '-n', `csps-package-${SHA}`, '-D', '/work/pkg']);
    expect(world.labels()).toEqual(['gh run list', 'gh run download']);
  });

  it('asks only for successful runs of ci.yml on main for that exact commit', async () => {
    const world = ghWorld([runOf('push')], []);

    await findPackage(SHA, { ...world.deps, run: world.deps.spawn, dir: '/work/pkg' });

    expect(world.calls[0]?.args).toEqual([
      'run',
      'list',
      '--workflow',
      'ci.yml',
      '--branch',
      'main',
      '--commit',
      SHA,
      '--status',
      'success',
      '--json',
      'databaseId,event,headSha',
    ]);
  });

  it('skips a pull request run and a run of another commit', async () => {
    const world = ghWorld([runOf('pull_request'), runOf('push', 'f'.repeat(40))], []);

    await expect(findPackage(SHA, { ...world.deps, run: world.deps.spawn, dir: '/work/pkg' })).rejects.toThrow(
      `No CI-passed build or deploy release exists for ${SHA7}.`,
    );
  });

  it('falls back to the deploy release for that sha when no CI run has an artifact', async () => {
    const world = ghWorld([], [{ tagName: TAG, createdAt: '2026-10-20T03:04:10Z', isDraft: false }]);

    const found = await findPackage(SHA, { ...world.deps, run: world.deps.spawn, dir: '/work/pkg' });

    expect(found.source).toBe('release');
    expect(world.labels()).toEqual(['gh run list', 'gh release list', 'gh release download', 'unzip']);
    expect(world.calls[2]?.args).toEqual(['release', 'download', TAG, '-p', 'site.zip', '-D', '/work/pkg']);
  });

  it('falls back to the release when the artifact download fails (the 14-day retention ended)', async () => {
    const world = ghWorld([runOf('push')], [{ tagName: TAG, createdAt: '2026-10-20T03:04:10Z', isDraft: false }], {
      'gh run download': [1],
    });

    const found = await findPackage(SHA, { ...world.deps, run: world.deps.spawn, dir: '/work/pkg' });

    expect(found.source).toBe('release');
  });

  it('throws when neither a CI build nor a deploy release exists', async () => {
    const world = ghWorld([], []);

    await expect(findPackage(SHA, { ...world.deps, run: world.deps.spawn, dir: '/work/pkg' })).rejects.toThrow(
      `No CI-passed build or deploy release exists for ${SHA7}.`,
    );
  });

  it.each(['', 'abc', 'G'.repeat(40), SHA.toUpperCase(), `${SHA}0`])(
    'refuses the sha %j before any gh call',
    async (bad) => {
      const world = ghWorld([runOf('push')], []);

      await expect(findPackage(bad, { ...world.deps, run: world.deps.spawn, dir: '/work/pkg' })).rejects.toThrow(
        'The commit sha must be 40 lowercase hex characters.',
      );
      expect(world.calls).toEqual([]);
    },
  );
});

describe('executeDeploy happy path', () => {
  const steps = () =>
    planDeploy({ action: 'deploy', dryRun: false, packageDir: PACKAGE_DIR, lastGood: null, config: CONFIG });
  const deps = (world: World) => ({
    ...world.deps,
    secrets: [PASSWORD],
    policy: 'deploy' as const,
    rollback: null,
    sha7: SHA7,
  });

  it('runs offline, wait, sync, online, smoke and the release in order and exits 0', async () => {
    const world = fakeWorld();

    const result = await executeDeploy(steps(), deps(world));

    expect(result.exitCode).toBe(0);
    expect(world.labels()).toEqual(['offline', 'sync', 'online', 'smoke', 'zip', 'gh release create']);
    expect(world.sleeps).toEqual([5000]);
    expect(result.releaseTag).toBe(TAG);
  });

  it('spawns msdeploy with verbatim arguments and the program name quoted, and the others plainly', async () => {
    const world = fakeWorld();

    await executeDeploy(steps(), deps(world));

    const msdeploy = world.calls.filter((call) => call.command === MSDEPLOY_PATH);
    expect(msdeploy.length).toBe(3);
    expect(msdeploy.every((call) => call.options.windowsVerbatimArguments === true)).toBe(true);
    expect(msdeploy.every((call) => call.options.argv0 === `"${MSDEPLOY_PATH}"`)).toBe(true);
    expect(
      world.calls
        .filter((call) => call.command !== MSDEPLOY_PATH)
        .every((call) => call.options.windowsVerbatimArguments !== true),
    ).toBe(true);
  });

  it('never logs the password, even when a tool echoes it', async () => {
    const world = fakeWorld({}, { sync: `Info: connecting as deployer with ${PASSWORD}` });

    await executeDeploy(steps(), deps(world));

    expect(everythingLogged(world)).not.toContain(PASSWORD);
    expect(everythingLogged(world)).toContain('***');
  });
});

describe('main', () => {
  const ENV = {
    INPUT_ACTION: 'deploy',
    INPUT_SHA: SHA,
    INPUT_DRY_RUN: 'false',
    WEBDEPLOY_SERVER: 'host.example',
    WEBDEPLOY_SITE: 'site1',
    WEBDEPLOY_USERNAME: 'deployer',
    WEBDEPLOY_PASSWORD: PASSWORD,
    SITE_ORIGIN: ORIGIN,
    RUNNER_TEMP: '/work',
    GITHUB_STEP_SUMMARY: '/work/summary.md',
  };
  const gh = {
    'gh run list': JSON.stringify([{ databaseId: 42, event: 'push', headSha: SHA }]),
    'gh release list': '[]',
  };

  it('prints the plan with the password redacted and spawns nothing', async () => {
    const world = fakeWorld();

    const code = await main(ENV, world.deps, ['--plan']);

    expect(code).toBe(0);
    expect(world.calls).toEqual([]);
    const text = world.logged.join('\n');
    expect(text).toContain('app_offline');
    expect(text).toContain('smoke.mjs');
    expect(text).toContain('password=***');
    expect(text).not.toContain(PASSWORD);
  });

  it('refuses an empty or malformed sha before anything runs', async () => {
    for (const bad of ['', 'xyz', SHA.slice(1)]) {
      const world = fakeWorld();

      const code = await main({ ...ENV, INPUT_SHA: bad }, world.deps, []);

      expect(code).toBe(1);
      expect(world.calls).toEqual([]);
      expect(world.logged.join('\n')).toContain('The commit sha must be 40 lowercase hex characters.');
    }
  });

  it('refuses an unknown action and a missing credential by name', async () => {
    const unknown = fakeWorld();
    const missing = fakeWorld();

    expect(await main({ ...ENV, INPUT_ACTION: 'wipe' }, unknown.deps, [])).toBe(1);
    expect(await main({ ...ENV, WEBDEPLOY_PASSWORD: '' }, missing.deps, [])).toBe(1);
    expect(unknown.logged.join('\n')).toContain('INPUT_ACTION must be deploy, online or hostprobe.');
    expect(missing.logged.join('\n')).toContain('WEBDEPLOY_PASSWORD is not set.');
    expect([...unknown.calls, ...missing.calls]).toEqual([]);
  });

  it('refuses a password with a separator character without echoing it', async () => {
    const world = fakeWorld();

    const code = await main({ ...ENV, WEBDEPLOY_PASSWORD: 'a;b,c' }, world.deps, []);

    expect(code).toBe(1);
    expect(everythingLogged(world)).toContain('The Web Deploy password contains a character msdeploy cannot take');
    expect(everythingLogged(world)).not.toContain('a;b,c');
    expect(world.calls).toEqual([]);
  });

  it('fails clearly when msdeploy.exe is missing', async () => {
    const world = fakeWorld();

    const code = await main(ENV, { ...world.deps, exists: (file: string) => file !== MSDEPLOY_PATH }, []);

    expect(code).toBe(1);
    expect(world.logged.join('\n')).toContain(
      `msdeploy.exe was not found at ${MSDEPLOY_PATH}. The windows-2025 image should include Web Deploy.`,
    );
    expect(world.calls).toEqual([]);
  });

  it('deploys end to end: finds the package, syncs, smokes, creates the release and writes the summary', async () => {
    const world = fakeWorld({}, gh);

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(0);
    expect(world.labels()).toEqual([
      'gh run list',
      'gh run download',
      'gh release list',
      'offline',
      'sync',
      'online',
      'smoke',
      'zip',
      'gh release create',
    ]);
    expect(world.summary.join('')).toContain(TAG);
    expect(world.summary.join('')).toContain(SHA7);
    expect(everythingLogged(world)).not.toContain(PASSWORD);
  });

  it('adds -allowUntrusted only after the certificate pin matches, and refuses a mismatch', async () => {
    const pinned = { ...ENV, WEBDEPLOY_CERT_SHA256: 'aa:bb' };
    const match = fakeWorld({}, gh);
    const mismatch = fakeWorld({}, gh);

    expect(await main(pinned, match.deps, [])).toBe(0);
    expect(await main({ ...pinned, WEBDEPLOY_CERT_SHA256: 'cc:dd' }, mismatch.deps, [])).toBe(1);

    expect(
      match.calls
        .filter((call) => call.command === MSDEPLOY_PATH)
        .every((call) => call.args.includes('-allowUntrusted')),
    ).toBe(true);
    expect(mismatch.calls).toEqual([]);
    expect(mismatch.logged.join('\n')).toContain('does not match WEBDEPLOY_CERT_SHA256');
  });

  it('never uses -allowUntrusted when no fingerprint is set', async () => {
    const world = fakeWorld({}, gh);

    await main(ENV, world.deps, []);

    expect(world.calls.some((call) => call.args.includes('-allowUntrusted'))).toBe(false);
  });
});

describe('buildDestination hardening (CWE-88)', () => {
  it.each([' ', '\t', '\n'])('refuses a password holding the whitespace %j without echoing it', (bad) => {
    let message = '';
    try {
      buildDestination({ ...CONNECTION, password: `ab${bad}cd -verb:delete` });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe(
      'The Web Deploy password contains a space or control character msdeploy cannot take. Choose one without it.',
    );
    expect(message).not.toContain('-verb:delete');
  });
});

describe('executeDeploy failure paths', () => {
  const deployPlan = (lastGood: typeof LAST_GOOD | null) =>
    planDeploy({ action: 'deploy', dryRun: false, packageDir: PACKAGE_DIR, lastGood, config: CONFIG });
  const executeDeps = (world: World) => ({ ...world.deps, secrets: [PASSWORD] });
  const KIT = 'D-05 legacy rollback kit';

  it('rolls back to the last good release when the smoke test fails: offline, sync it, online, smoke', async () => {
    const world = fakeWorld({ smoke: [1, 0] });

    const result = await executeDeploy(deployPlan(LAST_GOOD), executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(world.labels()).toEqual([
      'offline',
      'sync',
      'online',
      'smoke',
      'offline',
      'sync-last-good',
      'online',
      'smoke',
    ]);
    expect(result.messages.join(' ')).toContain(`Rolled back to ${LAST_GOOD.tag}.`);
    expect(result.releaseTag).toBeUndefined();
    expect(world.sleeps).toEqual([5000, 5000]);
  });

  it('takes the same rollback path when the sync fails', async () => {
    const world = fakeWorld({ sync: [1] });

    const result = await executeDeploy(deployPlan(LAST_GOOD), executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(world.labels()).toEqual(['offline', 'sync', 'offline', 'sync-last-good', 'online', 'smoke']);
    expect(result.messages.join(' ')).toContain(`Rolled back to ${LAST_GOOD.tag}.`);
  });

  it('puts the offline page back and names the D-05 kit when the rollback smoke fails too', async () => {
    const world = fakeWorld({ smoke: [1, 1] });

    const result = await executeDeploy(deployPlan(LAST_GOOD), executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(world.labels().slice(-2)).toEqual(['smoke', 'offline']);
    const text = result.messages.join(' ');
    expect(text).toContain(KIT);
    expect(text).toContain('docs/operations/deploy.md');
    expect(text).not.toContain('Rolled back to');
  });

  it('puts the offline page back when the rollback sync fails', async () => {
    const world = fakeWorld({ smoke: [1], 'sync-last-good': [1] });

    const result = await executeDeploy(deployPlan(LAST_GOOD), executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(world.labels().slice(-2)).toEqual(['sync-last-good', 'offline']);
    expect(result.messages.join(' ')).toContain(KIT);
  });

  it('on a first deploy with a failed smoke puts the offline page back, makes no release and names the D-05 kit', async () => {
    const world = fakeWorld({ smoke: [1] });

    const result = await executeDeploy(deployPlan(null), executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(world.labels()).toEqual(['offline', 'sync', 'online', 'smoke', 'offline']);
    expect(result.messages.join(' ')).toContain(KIT);
    expect(result.messages.join(' ')).toContain('docs/operations/deploy.md');
  });

  it('keeps a live, smoke-tested site and reports it when only the release cannot be created', async () => {
    const world = fakeWorld({ 'gh release create': [1] });

    const result = await executeDeploy(deployPlan(LAST_GOOD), executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(world.labels()).toEqual(['offline', 'sync', 'online', 'smoke', 'zip', 'gh release create']);
    expect(result.messages.join(' ')).toContain('passed the smoke test');
    expect(result.messages.join(' ')).not.toContain('Rolled back');
  });

  it('stops and changes nothing else when the offline page cannot be uploaded', async () => {
    const world = fakeWorld({ offline: [1] });

    const result = await executeDeploy(deployPlan(LAST_GOOD), executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(world.labels()).toEqual(['offline', 'online']);
    expect(result.messages.join(' ')).toContain('The site was not changed');
  });

  it('treats a spawn that throws as a failed step and still redacts the message', async () => {
    const world = fakeWorld();
    const deps = {
      ...executeDeps(world),
      spawn: (): never => {
        throw new Error(`spawn failed for ${PASSWORD}`);
      },
    };

    const result = await executeDeploy(deployPlan(null), deps);

    expect(result.exitCode).toBe(1);
    expect(everythingLogged(world)).not.toContain(PASSWORD);
  });

  it('never leaves app_offline.htm in place after a clean deploy', async () => {
    const world = fakeWorld();

    const result = await executeDeploy(deployPlan(LAST_GOOD), executeDeps(world));

    const labels = world.labels();
    expect(result.exitCode).toBe(0);
    expect(labels.lastIndexOf('online')).toBeGreaterThan(labels.lastIndexOf('offline'));
  });

  it('fails a plan that would end with app_offline.htm still on the site, instead of reporting success', async () => {
    const world = fakeWorld();
    const endsOffline = Object.assign(deployPlan(null).slice(0, 3), { rollback: null, onFailure: 'rollback' as const });

    const result = await executeDeploy(endsOffline, executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(result.messages.join(' ')).toContain('app_offline.htm may still be on the site');
  });

  it('fails a dry run without any rollback', async () => {
    const world = fakeWorld({ whatif: [1] });
    const plan = planDeploy({
      action: 'deploy',
      dryRun: true,
      packageDir: PACKAGE_DIR,
      lastGood: LAST_GOOD,
      config: CONFIG,
    });

    const result = await executeDeploy(plan, executeDeps(world));

    expect(result.exitCode).toBe(1);
    expect(world.labels()).toEqual(['whatif']);
  });
});

describe('main failure paths and actions', () => {
  const ENV = {
    INPUT_ACTION: 'deploy',
    INPUT_SHA: SHA,
    INPUT_DRY_RUN: 'false',
    WEBDEPLOY_SERVER: 'host.example',
    WEBDEPLOY_SITE: 'site1',
    WEBDEPLOY_USERNAME: 'deployer',
    WEBDEPLOY_PASSWORD: PASSWORD,
    SITE_ORIGIN: ORIGIN,
    RUNNER_TEMP: '/work',
    GITHUB_STEP_SUMMARY: '/work/summary.md',
  };
  const runList = JSON.stringify([{ databaseId: 42, event: 'push', headSha: SHA }]);
  const previous = [{ tagName: LAST_GOOD.tag, createdAt: '2026-10-19T01:01:05Z', isDraft: false }];

  it('downloads the last good release before touching the site and rolls back to it when the smoke fails', async () => {
    const world = fakeWorld({ smoke: [1, 0] }, { 'gh run list': runList, 'gh release list': JSON.stringify(previous) });

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(1);
    expect(world.labels()).toEqual([
      'gh run list',
      'gh run download',
      'gh release list',
      'gh release download',
      'unzip',
      'offline',
      'sync',
      'online',
      'smoke',
      'offline',
      'sync-last-good',
      'online',
      'smoke',
    ]);
    expect(world.summary.join('')).toContain(`Rolled back to ${LAST_GOOD.tag}.`);
  });

  it('refuses to deploy when the last good release cannot be downloaded', async () => {
    const world = fakeWorld(
      { 'gh release download': [1] },
      { 'gh run list': runList, 'gh release list': JSON.stringify(previous) },
    );

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(1);
    expect(world.labels()).toEqual(['gh run list', 'gh run download', 'gh release list', 'gh release download']);
    expect(world.logged.join('\n')).toContain(`The release ${LAST_GOOD.tag} could not be downloaded.`);
  });

  it('never rolls back onto the sha being deployed', async () => {
    const same = [{ tagName: TAG, createdAt: '2026-10-20T03:04:10Z', isDraft: false }];
    const world = fakeWorld({ smoke: [1] }, { 'gh run list': runList, 'gh release list': JSON.stringify(same) });

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(1);
    expect(world.labels()).toEqual([
      'gh run list',
      'gh run download',
      'gh release list',
      'offline',
      'sync',
      'online',
      'smoke',
      'offline',
    ]);
  });

  it('runs a dry run as the package lookup and one whatif sync, nothing else', async () => {
    const world = fakeWorld({}, { 'gh run list': runList });

    const code = await main({ ...ENV, INPUT_DRY_RUN: 'true' }, world.deps, []);

    expect(code).toBe(0);
    expect(world.labels()).toEqual(['gh run list', 'gh run download', 'whatif']);
    expect(world.sleeps).toEqual([]);
  });

  it('runs the online action as exactly one msdeploy delete, with no sha needed', async () => {
    const world = fakeWorld();
    const env: Record<string, string | undefined> = { ...ENV, INPUT_ACTION: 'online' };
    delete env.INPUT_SHA;
    delete env.SITE_ORIGIN;

    const code = await main(env, world.deps, []);

    expect(code).toBe(0);
    expect(world.labels()).toEqual(['online']);
    expect(world.calls[0]?.args[0]).toBe('-verb:delete');
  });

  it('makes the online action a whatif delete on a dry run, so nothing on the site changes', async () => {
    const world = fakeWorld();

    const code = await main({ ...ENV, INPUT_ACTION: 'online', INPUT_DRY_RUN: 'true' }, world.deps, []);

    expect(code).toBe(0);
    expect(world.calls).toHaveLength(1);
    expect(world.calls[0]?.args).toContain('-verb:delete');
    expect(world.calls[0]?.args).toContain('-whatif');
  });

  it('plans the online action with -whatif only on a dry run', () => {
    const dry = planDeploy({ action: 'online', dryRun: true, packageDir: null, lastGood: null, config: CONFIG });
    const real = planDeploy({ action: 'online', dryRun: false, packageDir: null, lastGood: null, config: CONFIG });

    expect(dry[0]?.args).toContain('-whatif');
    expect(real[0]?.args).not.toContain('-whatif');
  });

  it('exits with the failure of the online action', async () => {
    const world = fakeWorld({ online: [1] });

    const code = await main({ ...ENV, INPUT_ACTION: 'online' }, world.deps, []);

    expect(code).toBe(1);
    expect(world.labels()).toEqual(['online']);
  });
});

describe('withProbeKey', () => {
  it('sets HostProbe.Key and keeps every other setting', () => {
    const json = '{"HostProbe":{"Key":""},"Logging":{"LogLevel":{"Default":"Warning"}},"AllowedHosts":"*"}';

    const result = JSON.parse(withProbeKey(json, 'k'.repeat(40))) as Record<string, unknown>;

    expect(result).toEqual({
      HostProbe: { Key: 'k'.repeat(40) },
      Logging: { LogLevel: { Default: 'Warning' } },
      AllowedHosts: '*',
    });
  });
});

describe('withProbeKey and a byte order mark', () => {
  it('reads a settings file that starts with a byte order mark', () => {
    const json = `${String.fromCodePoint(0xfeff)}{"HostProbe":{"Key":""}}`;

    expect(JSON.parse(withProbeKey(json, 'k'.repeat(32)))).toEqual({ HostProbe: { Key: 'k'.repeat(32) } });
  });
});

describe('injectProbeWebConfig', () => {
  const WEB_CONFIG = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<configuration>',
    '  <location path="." inheritInChildApplications="false">',
    '    <system.webServer>',
    '      <handlers>',
    '        <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />',
    '      </handlers>',
    '      <aspNetCore processPath="dotnet" arguments=".\\Csps.HostProbe.dll" hostingModel="inprocess" />',
    '    </system.webServer>',
    '  </location>',
    '</configuration>',
  ].join('\n');
  const COMPRESSION = '<urlCompression doStaticCompression="false" doDynamicCompression="false" />';

  it('adds the urlCompression element and nothing else new, keeping the handlers', () => {
    const result = injectProbeWebConfig(WEB_CONFIG, { rewrite: false });

    expect(result.split(COMPRESSION).length - 1).toBe(1);
    expect(result).not.toContain('<rewrite>');
    expect(result).toContain('modules="AspNetCoreModuleV2"');
    expect(result).toContain('hostingModel="inprocess"');
  });

  it('adds one HTTP-to-HTTPS rewrite rule inside system.webServer when asked', () => {
    const result = injectProbeWebConfig(WEB_CONFIG, { rewrite: true });

    expect(result.split('<rule ').length - 1).toBe(1);
    expect(result).toContain('redirectType="Permanent"');
    expect(result.indexOf('<rewrite>')).toBeGreaterThan(result.indexOf('<system.webServer>'));
    expect(result.indexOf('</rewrite>')).toBeLessThan(result.indexOf('</system.webServer>'));
  });

  it('replaces an existing urlCompression instead of adding a second one (a duplicate gives a 500.19)', () => {
    const withExisting = WEB_CONFIG.replace('</handlers>', '</handlers><urlCompression doStaticCompression="true" />');

    const result = injectProbeWebConfig(withExisting, { rewrite: false });

    expect(result.split('<urlCompression').length - 1).toBe(1);
    expect(result).toContain(COMPRESSION);
  });

  it('refuses a web.config without a system.webServer element', () => {
    expect(() => injectProbeWebConfig('<configuration></configuration>', { rewrite: false })).toThrow(
      'The probe web.config has no system.webServer element.',
    );
  });
});

describe('hostprobe action', () => {
  const KEY = `PROBEKEY-${'0123456789'.repeat(3)}`;
  const SETTINGS = '{"HostProbe":{"Key":""},"AllowedHosts":"*"}';
  const WEB = '<configuration><system.webServer><handlers /></system.webServer></configuration>';
  const ENV = {
    INPUT_ACTION: 'hostprobe',
    INPUT_DRY_RUN: 'false',
    INPUT_PROBE_REWRITE: 'false',
    HOSTPROBE_KEY: KEY,
    WEBDEPLOY_SERVER: 'host.example',
    WEBDEPLOY_SITE: 'site1',
    WEBDEPLOY_USERNAME: 'deployer',
    WEBDEPLOY_PASSWORD: PASSWORD,
    SITE_ORIGIN: ORIGIN,
    RUNNER_TEMP: '/work',
    GITHUB_STEP_SUMMARY: '/work/summary.md',
  };
  const probeWorld = (script: Readonly<Record<string, readonly number[]>> = {}, releases: readonly unknown[] = []) =>
    fakeWorld(
      script,
      { 'gh release list': JSON.stringify(releases) },
      { 'appsettings.json': SETTINGS, 'web.config': WEB },
    );

  it('plans offline, wait, sync, online and the probe reader, with no release and no rollback', () => {
    const steps = planDeploy({
      action: 'hostprobe',
      dryRun: false,
      packageDir: '/work/csps-deploy/probe',
      lastGood: null,
      config: CONFIG,
    });

    expect(steps.map((step) => step.name)).toEqual(['offline', 'wait', 'sync', 'online', 'smoke']);
    expect(steps[4]?.args?.slice(1)).toEqual(['probe', '--origin', ORIGIN]);
    expect(steps.rollback).toBeNull();
  });

  it('publishes the probe, writes the key and the compression setting, syncs it and reads it', async () => {
    const world = probeWorld();

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(0);
    expect(world.labels()).toEqual(['gh release list', 'dotnet publish', 'offline', 'sync', 'online', 'smoke-probe']);
    const publish = world.calls[1];
    expect(publish?.args.slice(0, 1)).toEqual(['publish']);
    expect(publish?.args).toContain('Release');
    expect(JSON.parse(world.files.get('appsettings.json') ?? '{}')).toEqual({
      HostProbe: { Key: KEY },
      AllowedHosts: '*',
    });
    expect(world.files.get('web.config')).toContain('<urlCompression doStaticCompression="false"');
    expect(world.files.get('web.config')).not.toContain('<rewrite>');
  });

  it('adds the HTTP-to-HTTPS rule only when INPUT_PROBE_REWRITE is true', async () => {
    const world = probeWorld();

    await main({ ...ENV, INPUT_PROBE_REWRITE: 'true' }, world.deps, []);

    expect(world.files.get('web.config')).toContain('<rewrite>');
  });

  it('never logs the probe key or the password', async () => {
    const world = probeWorld();

    await main(ENV, world.deps, []);

    expect(everythingLogged(world)).not.toContain(KEY);
    expect(everythingLogged(world)).not.toContain(PASSWORD);
  });

  it('never passes the probe key as an argument; the smoke reader takes it from the environment', async () => {
    const world = probeWorld();

    await main(ENV, world.deps, []);

    expect(world.calls.every((call) => !call.args.some((arg) => arg.includes(KEY)))).toBe(true);
  });

  it.each([
    ['', 'HOSTPROBE_KEY is not set.'],
    ['short-key', 'HOSTPROBE_KEY must be at least 32 characters.'],
  ])('refuses the key %j before publishing anything', async (key, message) => {
    const world = probeWorld();

    const code = await main({ ...ENV, HOSTPROBE_KEY: key }, world.deps, []);

    expect(code).toBe(1);
    expect(world.calls).toEqual([]);
    expect(world.logged.join('\n')).toContain(message);
    if (key !== '') {
      expect(world.logged.join('\n')).not.toContain(key);
    }
  });

  it('puts the offline page back, makes no release and does not roll back when the probe sync fails', async () => {
    const world = probeWorld({ sync: [1] });

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(1);
    expect(world.labels()).toEqual(['gh release list', 'dotnet publish', 'offline', 'sync', 'offline']);
    expect(world.labels().some((name) => name.startsWith('gh'))).toBe(false);
  });

  it('refuses to replace a site that already has a deploy release, before publishing or touching the host', async () => {
    const world = probeWorld({}, [{ tagName: TAG, createdAt: '2026-10-20T03:04:10Z', isDraft: false }]);

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(1);
    expect(world.labels()).toEqual(['gh release list']);
    expect(world.logged.join('\n')).toContain('The host check runs only before the first deploy');
  });

  it('refuses when the releases cannot be listed, because it cannot tell whether CSPS is live', async () => {
    const world = probeWorld({ 'gh release list': [1] });

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(1);
    expect(world.labels()).toEqual(['gh release list']);
  });

  it('is not stopped by drafts or releases that are not deploy releases', async () => {
    const world = probeWorld({}, [
      { tagName: 'v1.0.0', createdAt: '2026-10-19T02:00:00Z', isDraft: false },
      { tagName: TAG, createdAt: '2026-10-20T03:04:10Z', isDraft: true },
    ]);

    expect(await main(ENV, world.deps, [])).toBe(0);
  });

  it('puts the offline page back when the probe cannot be read', async () => {
    const world = probeWorld({ 'smoke-probe': [1] });

    const code = await main(ENV, world.deps, []);

    expect(code).toBe(1);
    expect(world.labels().slice(-2)).toEqual(['smoke-probe', 'offline']);
  });
});
