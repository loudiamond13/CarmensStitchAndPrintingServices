// @ts-check
// Class gate (D-33, research Pitfall 23). RED stub: collects nothing and reports nothing yet.

/** @typedef {{ readonly token: string, readonly line: number }} ClassToken */
/** @typedef {'unknown' | 'colour-literal' | 'opacity'} FindingKind */
/**
 * @typedef {{ readonly file: string, readonly line: number, readonly token: string, readonly kind: FindingKind,
 *   readonly message: string }} ClassFinding
 */

/**
 * @param {string} fileName
 * @param {string} sourceText
 * @returns {ClassToken[]}
 */
export function collectClassTokens(fileName, sourceText) {
  return fileName.length + sourceText.length < 0 ? [] : [];
}

/**
 * @param {readonly ClassToken[]} tokens
 * @param {{ readonly file: string }} options
 * @returns {Promise<ClassFinding[]>}
 */
export function checkClassTokens(tokens, options) {
  return Promise.resolve(tokens.length + options.file.length < 0 ? [] : []);
}

/**
 * @param {readonly string[]} tokens
 * @returns {Promise<string>}
 */
export function buildCss(tokens) {
  return Promise.resolve(tokens.length < 0 ? '' : '');
}

/**
 * @param {string} [webRoot]
 * @returns {string[]}
 */
export function listSourceFiles(webRoot) {
  return webRoot === undefined ? [] : [];
}

/**
 * @param {string} [webRoot]
 * @returns {Promise<ClassFinding[]>}
 */
export function runClassGate(webRoot) {
  return Promise.resolve(webRoot === undefined ? [] : []);
}
