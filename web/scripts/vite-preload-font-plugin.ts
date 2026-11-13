// PERF-05 self-hosted fonts (research Pattern 14). Two small build plugins:
// - preloadFontPlugin adds one <link rel="preload" as="font"> for the hashed woff2 that matches `pattern`, found in the
//   final bundle, so the browser starts the LCP font download with the HTML. It is static markup, allowed under the
//   strict CSP (font-src 'self'), and the build fails closed when the match is missing or ambiguous.
// - woff2OnlyPlugin drops the legacy .woff fallback from the Fontsource stylesheets before Vite's CSS pipeline sees
//   them, so the build emits woff2 files only (every supported browser reads woff2).
import type { HtmlTagDescriptor, Plugin } from 'vite';

export function preloadFontPlugin(pattern: RegExp): Plugin {
  let base = '/';
  return {
    name: 'csps-preload-font',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      // After Vite has emitted the hashed assets, so ctx.bundle holds the real file names.
      order: 'post',
      handler(_html, ctx): HtmlTagDescriptor[] {
        if (ctx.bundle === undefined) {
          return this.error(`preloadFontPlugin: no bundle to search for ${pattern.source} (build only).`);
        }
        const matches = Object.keys(ctx.bundle).filter((fileName) => pattern.test(fileName));
        if (matches.length !== 1) {
          // Fail closed: a renamed, missing or duplicated font must break the build, not drop or double the preload.
          return this.error(
            matches.length === 0
              ? `preloadFontPlugin: no built asset matches ${pattern.source}.`
              : `preloadFontPlugin: more than one built asset matches ${pattern.source}: ${matches.join(', ')}.`,
          );
        }
        const fileName = matches[0] ?? '';
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              href: `${base}${fileName}`,
              crossorigin: true,
            },
            injectTo: 'head',
          },
        ];
      },
    },
  };
}

// A stylesheet inside an @fontsource or @fontsource-variable package (posix or Windows separators, optional query).
const FONTSOURCE_STYLESHEET = /[\\/]node_modules[\\/]@fontsource(?:-variable)?[\\/][^?]*\.css(?:\?.*)?$/;
// The legacy fallback Fontsource appends after each woff2 source: `, url(./files/x.woff) format('woff')`.
const LEGACY_WOFF_SOURCE = /,\s*url\([^)]*\.woff\)\s*format\(\s*["']woff["']\s*\)/g;
// Any url(...) that does not point at a .woff2 file.
const NON_WOFF2_URL = /url\((?![^)]*\.woff2\))[^)]*\)/;

export function woff2OnlyPlugin(): Plugin {
  return {
    name: 'csps-woff2-only',
    // Before vite:css resolves url(), so the dropped .woff files are never emitted.
    enforce: 'pre',
    transform: {
      handler(code, id) {
        if (!FONTSOURCE_STYLESHEET.test(id)) {
          return null;
        }
        const next = code.replace(LEGACY_WOFF_SOURCE, '');
        const leftover = NON_WOFF2_URL.exec(next);
        if (leftover !== null) {
          return this.error(`woff2OnlyPlugin: ${id} still ships a font that is not woff2: ${leftover[0]}.`);
        }
        return { code: next, map: null };
      },
    },
  };
}

// D-28, D-46 (plan 11-36). Barlow Condensed has no peso sign (U+20B1) in any subset (cmap checked), but its latin-ext faces list
// U+20A0-20C0 in their unicode-range, so a peso in display text made the browser download them for nothing: the peso falls
// through to Archivo Variable either way. Taking U+20B1 out of the Barlow ranges stops those requests and draws the same page.
// Archivo is not touched: its latin-ext file does hold the peso.
const BARLOW_STYLESHEET = /[\\/]node_modules[\\/]@fontsource[\\/]barlow-condensed[\\/][^?]*\.css(?:\?.*)?$/;
const PESO_SIGN = 0x20b1;
const UNICODE_RANGE = /(unicode-range\s*:\s*)([^;}]*)/g;
const RANGE_TOKEN = /^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i;

function formatRange(from: number, to: number): string {
  const hex = (value: number): string => value.toString(16).toUpperCase().padStart(4, '0');
  return from === to ? `U+${hex(from)}` : `U+${hex(from)}-${hex(to)}`;
}

/** The comma list with U+20B1 cut out of whichever range holds it; every other token is kept as written. */
function withoutPeso(list: string): string {
  const kept: string[] = [];
  for (const token of list.split(',').map((part) => part.trim())) {
    const match = RANGE_TOKEN.exec(token);
    const from = match?.[1] === undefined ? Number.NaN : Number.parseInt(match[1], 16);
    const to = match?.[2] === undefined ? from : Number.parseInt(match[2], 16);
    if (Number.isNaN(from) || PESO_SIGN < from || PESO_SIGN > to) {
      kept.push(token);
      continue;
    }
    if (from < PESO_SIGN) {
      kept.push(formatRange(from, PESO_SIGN - 1));
    }
    if (to > PESO_SIGN) {
      kept.push(formatRange(PESO_SIGN + 1, to));
    }
  }
  return kept.join(',');
}

export function barlowNoPesoPlugin(): Plugin {
  return {
    name: 'csps-barlow-no-peso',
    // Before vite:css reads the stylesheet, like woff2OnlyPlugin.
    enforce: 'pre',
    transform: {
      handler(code, id) {
        if (!BARLOW_STYLESHEET.test(id)) {
          return null;
        }
        const next = code.replace(UNICODE_RANGE, (_whole, prefix: string, list: string) => {
          const kept = withoutPeso(list);
          if (kept === '') {
            // An empty range is invalid CSS and would be ignored, so the face would then cover every character.
            return this.error(`barlowNoPesoPlugin: a face in ${id} lists only U+20B1, so no range would be left.`);
          }
          return `${prefix}${kept}`;
        });
        return next === code ? null : { code: next, map: null };
      },
    },
  };
}
