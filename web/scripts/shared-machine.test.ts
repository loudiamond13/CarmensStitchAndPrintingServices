// @vitest-environment node
// TOOL-WR-08: the shared-machine gate reads the shared preflight report and waits (then refuses) while one of this
// project's ports is in use by another program or another project's dev/test processes are listed. It never stops
// anything. The report text below follows C:\Work\dev-tools\preflight.ps1 (read-only, owned by both projects).
import { describe, expect, it } from 'vitest';
import {
  findBlockers,
  PREFLIGHT_ARGS,
  PREFLIGHT_SCRIPT,
  SHARED_MACHINE_TIMEOUT_MS,
  waitForSharedMachine,
} from './shared-machine.mjs';

function report({ ports = [] as string[], processes = ['  none'] } = {}): string {
  return [
    '== Ports',
    '  5180  free',
    '  5115  free',
    ...ports,
    '== Dev/test processes (node, dotnet hosts, Playwright browsers)',
    ...processes,
    '== LocalDB databases (MSSQLLocalDB)',
    '  BetsLLC_E2E                                   created 2026-10-07 09:09  sessions 0',
    '== Git worktrees of this repo',
    '  C:/Work/TheBETSLLC                                       c8fb301 [gsd/phase-06-contact-inquiries]',
    '== Machine-wide (User-level) variables that affect every session',
    '  BETS_TEST_DB not set',
    '',
  ].join('\r\n');
}

describe('findBlockers', () => {
  it('finds nothing in a clear report, whatever the LocalDB and worktree sections list', () => {
    expect(findBlockers(report())).toEqual([]);
  });

  it("blocks on a port of this project in use by TheBETSLLC's host", () => {
    const line =
      '  5199  IN USE by dotnet.exe (pid 4242) "C:\\Program Files\\dotnet\\dotnet.exe" C:\\Work\\TheBETSLLC\\src\\Api';
    expect(findBlockers(report({ ports: [line] }))).toEqual([
      'port 5199 is in use by dotnet.exe (pid 4242) "C:\\Program Files\\dotnet\\dotnet.exe" C:\\Work\\TheBETSLLC\\src\\Api',
    ]);
  });

  it('blocks on a port in use by a program of no known project', () => {
    expect(findBlockers(report({ ports: ['  5180  IN USE by Code.exe (pid 7) '] }))).toHaveLength(1);
  });

  it("does not block on a port held by this project's own host or dev server", () => {
    const ours = [
      '  5115  IN USE by Csps.Server.exe (pid 11) ',
      '  5180  IN USE by node.exe (pid 12) node C:\\Work\\CarmensStitchAndPrintingServices\\web\\node_modules\\vite\\bin',
    ];
    expect(findBlockers(report({ ports: ours }))).toEqual([]);
  });

  it("blocks on another project's listed test processes", () => {
    const processes = [
      '  5120   node.exe               "C:\\Program Files\\nodejs\\node.exe" C:\\Work\\TheBETSLLC\\web\\node_modules\\@playwright\\test\\cli.js test',
      '  5121   BetsLLC.Api.Tests.exe  C:\\x\\BetsLLC.Api.Tests.exe',
      '  5122   node.exe               node C:\\Work\\CarmensStitchAndPrintingServices\\web\\scripts\\e2e.mjs',
    ];
    const blockers = findBlockers(report({ processes }));
    expect(blockers).toHaveLength(2);
    expect(blockers[0]).toContain('TheBETSLLC');
    expect(blockers[1]).toContain('BetsLLC.Api.Tests.exe');
  });

  it("does not block on another project's editor helpers (they are not test or dev runs)", () => {
    const processes = [
      '  77     node.exe               "C:\\Program Files\\nodejs\\node.exe" C:\\Work\\TheBETSLLC\\web\\node_modules\\typescript\\lib\\tsserver.js',
    ];
    expect(findBlockers(report({ processes }))).toEqual([]);
  });

  it('does not take the LocalDB or worktree sections as processes', () => {
    expect(findBlockers(report()).join('\n')).not.toContain('BetsLLC_E2E');
  });

  it('blocks when the report has no ports section (a changed or broken report never passes as clear)', () => {
    expect(findBlockers('something else\n')).toEqual([
      'the preflight report has no "== Ports" section, so the machine could not be checked',
    ]);
  });
});

describe('waitForSharedMachine', () => {
  function clock() {
    let time = 0;
    const sleeps: number[] = [];
    return {
      sleeps,
      now: () => time,
      sleep: (ms: number) => {
        sleeps.push(ms);
        time += ms;
        return Promise.resolve();
      },
    };
  }

  it('runs the shared preflight with this project ports', () => {
    expect(PREFLIGHT_SCRIPT).toBe('C:\\Work\\dev-tools\\preflight.ps1');
    expect(PREFLIGHT_ARGS).toEqual([
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      PREFLIGHT_SCRIPT,
      '-Ports',
      '5180,5115,7028,5199',
    ]);
  });

  it('says so, and lets the run start, when the preflight script is not on this machine', async () => {
    const lines: string[] = [];
    const result = await waitForSharedMachine({
      label: 'e2e',
      available: false,
      run: () => {
        throw new Error('must not run');
      },
      log: (line) => lines.push(line),
    });
    expect(result).toBeNull();
    expect(lines).toEqual([expect.stringContaining('is not on this machine')]);
  });

  it('lets the run start at once when the report is clear', async () => {
    const { sleeps, now, sleep } = clock();
    const result = await waitForSharedMachine({
      label: 'e2e',
      available: true,
      run: () => ({ status: 0, stdout: report() }),
      now,
      sleep,
      log: () => undefined,
    });
    expect(result).toBeNull();
    expect(sleeps).toEqual([]);
  });

  it('waits while another project is busy and starts when it is done', async () => {
    const { sleeps, now, sleep } = clock();
    const busy = report({ processes: ['  1  node.exe  node C:\\Work\\TheBETSLLC\\x.js'] });
    const outputs = [busy, busy, report()];
    const lines: string[] = [];
    const result = await waitForSharedMachine({
      label: 'parity',
      available: true,
      run: () => ({ status: 0, stdout: outputs.shift() ?? report() }),
      pollMs: 30_000,
      now,
      sleep,
      log: (line) => lines.push(line),
    });
    expect(result).toBeNull();
    expect(sleeps).toEqual([30_000, 30_000]);
    // One message per change of reason, not one per poll.
    expect(lines).toEqual([expect.stringMatching(/^parity: waiting for the shared machine.*TheBETSLLC/)]);
  });

  it('refuses after 15 minutes, naming the reason and stopping nothing', async () => {
    const { now, sleep } = clock();
    const result = await waitForSharedMachine({
      label: 'lighthouse',
      available: true,
      run: () => ({
        status: 0,
        stdout: report({ ports: ['  5199  IN USE by dotnet.exe (pid 9) C:\\Work\\TheBETSLLC'] }),
      }),
      now,
      sleep,
      log: () => undefined,
    });
    expect(SHARED_MACHINE_TIMEOUT_MS).toBe(15 * 60 * 1000);
    expect(result).toMatch(
      /^lighthouse: the shared machine is still busy after 15 minutes: port 5199 .*Nothing was stopped/,
    );
  });

  it('treats a failing preflight as busy, never as clear', async () => {
    const { now, sleep } = clock();
    const result = await waitForSharedMachine({
      label: 'review',
      available: true,
      run: () => ({ status: 1, stdout: '' }),
      timeoutMs: 60_000,
      now,
      sleep,
      log: () => undefined,
    });
    expect(result).toContain('the preflight report failed with exit code 1');
  });
});
