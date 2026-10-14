// @vitest-environment node
// Pins the route-served parity hosting (WEB-02, threat T-02-37): the policy is the production StrictCsp read from the
// C# source (never a copy), a refactor that hides the constant fails loudly, and a request path can only ever read a
// file inside the dist folder.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentTypeFor, readStrictCsp, resolveDistFile, SECURITY_HEADERS_SOURCE } from './serve';

let folder = '';

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'csps-serve-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('readStrictCsp', () => {
  it('reads the production policy from SecurityHeadersMiddleware.cs', () => {
    const policy = readStrictCsp();

    expect(SECURITY_HEADERS_SOURCE.replaceAll('\\', '/')).toMatch(
      /src\/Csps\.Server\/Http\/SecurityHeadersMiddleware\.cs$/,
    );
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("style-src 'self'");
    expect(policy).not.toMatch(/unsafe-/);
  });

  it('fails loudly when the constant is missing or is no longer one plain string literal', () => {
    const file = path.join(folder, 'Middleware.cs');
    writeFileSync(file, 'public const string StrictCsp = Part1 + Part2;\n');

    expect(() => readStrictCsp(file)).toThrow(/StrictCsp/);
  });

  it('parses a single-line or wrapped declaration', () => {
    const file = path.join(folder, 'Middleware.cs');
    writeFileSync(file, "public const string StrictCsp =\r\n    \"img-src 'self'; object-src 'none'\";\r\n");

    expect(readStrictCsp(file)).toBe("img-src 'self'; object-src 'none'");
  });
});

describe('resolveDistFile', () => {
  let dist = '';

  beforeEach(() => {
    dist = path.join(folder, 'dist');
    mkdirSync(path.join(dist, 'assets'), { recursive: true });
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html>');
    writeFileSync(path.join(dist, 'assets', 'app.js'), '');
    writeFileSync(path.join(folder, 'outside.txt'), '');
  });

  it('serves a file that exists in the dist folder', () => {
    expect(resolveDistFile(dist, '/assets/app.js')).toBe(path.join(dist, 'assets', 'app.js'));
  });

  it('answers page paths (no extension) with index.html', () => {
    expect(resolveDistFile(dist, '/')).toBe(path.join(dist, 'index.html'));
    expect(resolveDistFile(dist, '/dev/components')).toBe(path.join(dist, 'index.html'));
  });

  it('returns null for a missing file, a folder, a bad escape and any path outside the dist folder', () => {
    mkdirSync(path.join(dist, 'assets.v1'));

    expect(resolveDistFile(dist, '/assets/missing.js')).toBeNull();
    expect(resolveDistFile(dist, '/assets.v1')).toBeNull();
    expect(resolveDistFile(dist, '/%E0%A4%A.js')).toBeNull();
    expect(resolveDistFile(dist, '/../outside.txt')).toBeNull();
    expect(resolveDistFile(dist, '/%2E%2E/outside.txt')).toBeNull();
    expect(resolveDistFile(dist, '/assets/..%5C..%5C..%5Coutside.txt')).toBeNull();
  });
});

describe('contentTypeFor', () => {
  it('maps the build output types and falls back to opaque bytes', () => {
    expect(contentTypeFor('a/index.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeFor('a/x.JS')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeFor('a/x.css')).toBe('text/css; charset=utf-8');
    expect(contentTypeFor('a/x.woff2')).toBe('font/woff2');
    expect(contentTypeFor('a/x.bin')).toBe('application/octet-stream');
  });
});
