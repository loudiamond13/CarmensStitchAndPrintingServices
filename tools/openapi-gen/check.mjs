// @ts-check
// D-16 drift check: regenerates the API types from the committed OpenAPI snapshot in memory and fails when the
// committed web/src/types/api.generated.ts differs. It writes nothing. `npm run generate` (the openapi-typescript CLI)
// produces the same text: COMMENT_HEADER followed by astToString of the generated AST.
import { readFile } from 'node:fs/promises';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';

const snapshot = new URL('./openapi.v1.json', import.meta.url);
const generated = new URL('../../web/src/types/api.generated.ts', import.meta.url);

/** @param {string} text */
const lf = (text) => text.replace(/\r\n/g, '\n');

const expected = lf(`${COMMENT_HEADER}${astToString(await openapiTS(snapshot, { silent: true }))}`);

/** @type {string | undefined} */
let committed;
try {
  committed = lf(await readFile(generated, 'utf8'));
} catch {
  committed = undefined;
}

if (committed !== expected) {
  console.error('Generated API types are out of date; run npm --prefix tools/openapi-gen run generate');
  process.exit(1);
}

console.log('Generated API types match tools/openapi-gen/openapi.v1.json.');
