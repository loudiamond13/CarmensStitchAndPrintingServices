// D-28, D-46 (plan 11-36): after the files are written, every .js, .css and .svg over 1 KB gets a Brotli (quality 11)
// twin, `name.js.br`, made with node:zlib (no package). The server sends the twin to a browser that accepts Brotli
// (src/Csps.Server/Http/PrecompressedStaticFiles.cs). The whole output folder is walked, so the files Vite copies from
// public/ (mark.svg) are covered as well as the bundle. HTML, fonts and JSON get no twin: the shell is built per request,
// woff2 is already compressed, and JSON is never compressed (BREACH, D-43).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import type { Plugin } from 'vite';

/** A file gets a .br twin only when it is larger than this many bytes. */
export const BROTLI_MIN_BYTES = 1024;

const COMPRESSIBLE = /\.(?:js|css|svg)$/i;

/** Every file under `directory`, as full paths. */
function filesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...filesUnder(full));
    } else {
      found.push(full);
    }
  }
  return found;
}

export function brotliPlugin(): Plugin {
  let outDir = '';
  return {
    name: 'csps:brotli',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle(options) {
      const directory = options.dir === undefined ? outDir : path.resolve(options.dir);
      for (const file of filesUnder(directory)) {
        if (!COMPRESSIBLE.test(file) || statSync(file).size <= BROTLI_MIN_BYTES) {
          continue;
        }
        const content = readFileSync(file);
        const compressed = brotliCompressSync(content, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 11,
            [constants.BROTLI_PARAM_SIZE_HINT]: content.length,
          },
        });
        writeFileSync(`${file}.br`, compressed);
      }
    },
  };
}
