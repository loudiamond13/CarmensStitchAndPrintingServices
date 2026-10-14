// @ts-check
// Class gate (D-33, WEB-02, D-02; research Pitfall 23). The CSPS theme clears every Tailwind default (`--*: initial`),
// so a default-palette class (`bg-blue-500`) or a typo (`hover:bg-surfce`) compiles to no CSS at all, with no error.
// This gate collects every class token in the app source with the TypeScript AST (the D-15 `typescript` alias) and
// compiles each one against the real src/ui/app.css with tailwindcss's public compile(). A token that adds no CSS
// is `unknown`. A colour literal in a token is `colour-literal`, and an opacity token outside the D-02 allow-list in
// class-gate.config.mjs is `opacity`.
//
// Where class tokens are read:
// - JSX `className` string literals, and the string branches of expressions inside `className={…}`;
// - the arguments of `clsx(…)` and `tw(…)` calls: strings, arrays, object keys and conditional branches;
// - every string literal in a `*.recipe.ts` file, except import/export specifiers, property names and types;
// - a variable in any of those positions (TOOL-WR-06): a `const` of the same file is read through its initializer,
//   and `runClassGate` follows an imported one (through barrels, with the TypeScript checker) to its declaration in
//   another src module and checks it there. Props and parameters are read where their value is written.
//
// `node scripts/class-gate.mjs` prints every finding and exits 1 when there is one.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';
import ts from 'typescript';
import { COLOUR_LITERAL, OPACITY_ALLOW } from './class-gate.config.mjs';

/** @typedef {{ readonly token: string, readonly line: number }} ClassToken */
/** @typedef {'unknown' | 'colour-literal' | 'opacity'} FindingKind */
/**
 * @typedef {{ readonly file: string, readonly line: number, readonly token: string, readonly kind: FindingKind,
 *   readonly message: string }} ClassFinding
 */
/** @typedef {Awaited<ReturnType<typeof compile>>} Compiler */

const defaultWebRoot = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

/** The callees whose arguments are class strings (02-04 lint and Prettier read the same two). */
const classCallees = new Set(['clsx', 'tw']);

/**
 * Marker classes: Tailwind emits no CSS for them by design; the `group-*` and `peer-*` variants select them
 * (`group/nav`, `group/thumb`, UI-SPEC transcription rule 7).
 */
const markerClass = /^(?:group|peer)(?:\/[A-Za-z0-9_-]+)?$/;

// ---------------------------------------------------------------------------------------------------------------
// Collecting tokens
// ---------------------------------------------------------------------------------------------------------------

/**
 * Called for an identifier in a class position that names no `const` of its own file (an import, a prop, a parameter).
 * @typedef {(identifier: ts.Identifier) => void} UnresolvedIdentifier
 */

/**
 * Every class token in one source file, with the 1-based line it sits on.
 * @param {string} fileName Used for the script kind (`.tsx`) and the recipe rule (`*.recipe.ts`).
 * @param {string} sourceText
 * @param {{ sourceFile?: ts.SourceFile, onUnresolved?: UnresolvedIdentifier }} [options] `sourceFile`: the parsed file
 *   (from a ts.Program, so a checker can resolve its identifiers); `onUnresolved`: see UnresolvedIdentifier.
 * @returns {ClassToken[]}
 */
export function collectClassTokens(fileName, sourceText, options = {}) {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile =
    options.sourceFile ?? ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const collector = createCollector(sourceFile, fileName.endsWith('.recipe.ts'), options.onUnresolved);
  collector.visit(sourceFile);
  return collector.tokens;
}

/**
 * The class tokens one expression can produce, read in its own file (an imported class constant, TOOL-WR-06).
 * @param {ts.SourceFile} sourceFile
 * @param {ts.Expression} expression
 * @param {UnresolvedIdentifier} [onUnresolved]
 * @returns {ClassToken[]}
 */
function collectExpressionTokens(sourceFile, expression, onUnresolved) {
  const collector = createCollector(sourceFile, false, onUnresolved);
  collector.readClassExpression(expression);
  return collector.tokens;
}

/**
 * The `const` declarations of a file by name, with their initializers (several when a name is shadowed).
 * @param {ts.SourceFile} sourceFile
 * @returns {Map<string, ts.Expression[]>}
 */
function constInitializers(sourceFile) {
  /** @type {Map<string, ts.Expression[]>} */
  const byName = new Map();
  /** @param {ts.Node} node */
  const walk = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      byName.set(node.name.text, [...(byName.get(node.name.text) ?? []), node.initializer]);
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);
  return byName;
}

/**
 * The token reader for one file.
 * @param {ts.SourceFile} sourceFile
 * @param {boolean} isRecipe
 * @param {UnresolvedIdentifier} [onUnresolved]
 */
function createCollector(sourceFile, isRecipe, onUnresolved) {
  /** @type {ClassToken[]} */
  const tokens = [];
  /** Literal nodes already read, so a `tw('…')` inside a recipe is counted once. @type {Set<ts.Node>} */
  const seen = new Set();
  /** @type {Map<string, ts.Expression[]> | undefined} */
  let localConsts;
  /** Names being resolved right now, so a cycle of constants stops. @type {Set<string>} */
  const resolving = new Set();

  /**
   * Splits class text into tokens. `text` starts at `offset` characters after the node's start.
   * @param {string} text
   * @param {ts.Node} node
   * @param {number} offset
   */
  const addText = (text, node, offset) => {
    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile) + offset).line + 1;
    for (const match of text.matchAll(/\S+/g)) {
      const newlines = text.slice(0, match.index).split('\n').length - 1;
      tokens.push({ token: match[0], line: startLine + newlines });
    }
  };

  /**
   * Reads a string-like literal once (a template's static parts too; lint already bans substitutions in class
   * positions, and a fragment such as `bg-` then fails as unknown).
   * @param {ts.Node} node
   */
  const addLiteral = (node) => {
    if (seen.has(node)) {
      return;
    }
    seen.add(node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      addText(node.text, node, 1);
    } else if (ts.isTemplateExpression(node)) {
      addText(node.head.text, node, 1);
      for (const span of node.templateSpans) {
        seen.add(span.literal);
        addText(span.literal.text, span.literal, 1);
      }
    }
  };

  /**
   * Reads an object key in a class position (`clsx({ 'a b': on, hidden })`).
   * @param {ts.PropertyName} name
   */
  const addPropertyName = (name) => {
    if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
      addLiteral(name);
    } else if (ts.isIdentifier(name)) {
      addText(name.text, name, 0);
    } else if (ts.isComputedPropertyName(name)) {
      readClassExpression(name.expression);
    }
  };

  /**
   * Reads the class strings an expression in a class position can produce. Conditions are never read; nested
   * `clsx`/`tw` calls are read by the main walk.
   * @param {ts.Expression} expression
   */
  const readClassExpression = (expression) => {
    if (ts.isIdentifier(expression)) {
      readIdentifier(expression);
    } else if (
      ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression) ||
      ts.isTemplateExpression(expression)
    ) {
      addLiteral(expression);
    } else if (ts.isConditionalExpression(expression)) {
      readClassExpression(expression.whenTrue);
      readClassExpression(expression.whenFalse);
    } else if (ts.isBinaryExpression(expression)) {
      const operator = expression.operatorToken.kind;
      if (operator !== ts.SyntaxKind.AmpersandAmpersandToken && operator !== ts.SyntaxKind.CommaToken) {
        readClassExpression(expression.left);
      }
      readClassExpression(expression.right);
    } else if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isSatisfiesExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isSpreadElement(expression)
    ) {
      readClassExpression(expression.expression);
    } else if (ts.isArrayLiteralExpression(expression)) {
      expression.elements.forEach(readClassExpression);
    } else if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          addPropertyName(property.name);
        }
      }
    }
  };

  /**
   * A variable in a class position: a `const` of this file is read through its initializer (TOOL-WR-06); anything
   * else goes to onUnresolved.
   * @param {ts.Identifier} identifier
   */
  function readIdentifier(identifier) {
    const name = identifier.text;
    if (resolving.has(name)) {
      return;
    }
    localConsts ??= constInitializers(sourceFile);
    const initializers = localConsts.get(name);
    if (initializers === undefined) {
      onUnresolved?.(identifier);
      return;
    }
    resolving.add(name);
    initializers.forEach(readClassExpression);
    resolving.delete(name);
  }

  /**
   * A string literal in a recipe file that is not a class string: a property name, an element-access key or a
   * directive.
   * @param {ts.Node} node
   */
  const isRecipeNonClassLiteral = (node) => {
    const parent = node.parent;
    return (
      (ts.isPropertyAssignment(parent) && parent.name === node) ||
      (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) ||
      (ts.isExpressionStatement(parent) && parent.expression === node)
    );
  };

  /** @param {ts.Node} node */
  const visit = (node) => {
    if (
      ts.isTypeNode(node) ||
      ts.isImportDeclaration(node) ||
      ts.isExportDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node)
    ) {
      return;
    }
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'className' && node.initializer !== undefined) {
      const initializer = node.initializer;
      if (ts.isStringLiteral(initializer)) {
        addLiteral(initializer);
      } else if (ts.isJsxExpression(initializer) && initializer.expression !== undefined) {
        readClassExpression(initializer.expression);
      }
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      classCallees.has(node.expression.text)
    ) {
      node.arguments.forEach(readClassExpression);
    } else if (
      isRecipe &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) &&
      !isRecipeNonClassLiteral(node)
    ) {
      addLiteral(node);
    }
    ts.forEachChild(node, visit);
  };

  return { tokens, visit, readClassExpression };
}

// ---------------------------------------------------------------------------------------------------------------
// Checking tokens
// ---------------------------------------------------------------------------------------------------------------

/**
 * Resolves the stylesheets app.css imports: `tailwindcss` from the installed package, anything else from disk.
 * @param {string} id
 * @param {string} base
 */
function loadStylesheet(id, base) {
  const file = id === 'tailwindcss' ? require.resolve('tailwindcss/index.css') : path.resolve(base, id);
  return Promise.resolve({ path: file, base: path.dirname(file), content: readFileSync(file, 'utf8') });
}

/**
 * A fresh compiler over the real src/ui/app.css (the same theme and variants the build uses).
 * @param {string} [webRoot]
 * @returns {Promise<Compiler>}
 */
function createCompiler(webRoot = defaultWebRoot) {
  const appCss = path.join(webRoot, 'src', 'ui', 'app.css');
  return compile(readFileSync(appCss, 'utf8'), { base: path.dirname(appCss), from: appCss, loadStylesheet });
}

/**
 * The CSS that app.css generates for these tokens (one fresh compiler per call).
 * @param {readonly string[]} tokens
 * @returns {Promise<string>}
 */
export async function buildCss(tokens) {
  const compiler = await createCompiler();
  return compiler.build([...tokens]);
}

/**
 * `build()` is incremental: each call adds candidates and returns the whole stylesheet. A token is known when adding
 * it changes the output. Results are cached per token, so a repeated token is never re-added (which would look
 * unknown).
 * @typedef {{ readonly compiler: Compiler, output: string, readonly known: Map<string, boolean> }} CompilerState
 */

/** @type {Promise<CompilerState> | undefined} */
let sharedState;

/** @returns {Promise<CompilerState>} */
function compilerState() {
  sharedState ??= createCompiler().then((compiler) => ({ compiler, output: compiler.build([]), known: new Map() }));
  return sharedState;
}

/**
 * @param {CompilerState} state
 * @param {string} token
 */
function isKnown(state, token) {
  const cached = state.known.get(token);
  if (cached !== undefined) {
    return cached;
  }
  const next = state.compiler.build([token]);
  const known = next !== state.output;
  state.output = next;
  state.known.set(token, known);
  return known;
}

/**
 * The utility part of a token, after its variants (`group-hover/thumb:opacity-100` → `opacity-100`). Colons inside
 * brackets or parentheses (`[opacity:.5]`, `in-data-[ui=a:b]`) do not split.
 * @param {string} token
 */
function utilityOf(token) {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index += 1) {
    const char = token.charAt(index);
    if (char === '[' || char === '(') {
      depth += 1;
    } else if (char === ']' || char === ')') {
      depth -= 1;
    } else if (char === ':' && depth === 0) {
      start = index + 1;
    }
  }
  return token.slice(start).replace(/^!|!$/g, '');
}

/** @param {string} token */
const isOpacityToken = (token) => /^-?opacity-|^\[opacity:/.test(utilityOf(token));

/**
 * @param {string} token
 * @param {string} file
 */
const opacityAllowed = (token, file) =>
  OPACITY_ALLOW.some((entry) => entry.pattern.test(token) && (entry.files === undefined || entry.files.test(file)));

/**
 * Checks tokens from one file. Each token gets at most one finding: a colour literal first, then a stray opacity,
 * then a token that compiles to nothing.
 * @param {readonly ClassToken[]} tokens
 * @param {{ readonly file: string }} options `file` is relative to web/ with forward slashes (`src/components/Button.tsx`).
 * @returns {Promise<ClassFinding[]>}
 */
export async function checkClassTokens(tokens, options) {
  const state = await compilerState();
  const file = options.file.replaceAll('\\', '/');
  /** @type {ClassFinding[]} */
  const findings = [];
  for (const { token, line } of tokens) {
    /** @type {(kind: FindingKind, reason: string) => void} */
    const report = (kind, reason) => {
      findings.push({ file, line, token, kind, message: `${file}:${String(line)} \`${token}\`: ${reason}` });
    };
    if (COLOUR_LITERAL.test(token)) {
      report('colour-literal', 'a colour literal in a class; use a CSPS colour token (D-33).');
    } else if (isOpacityToken(token) && !opacityAllowed(token, file)) {
      report('opacity', 'opacity is not on the D-02 allow-list (class-gate.config.mjs); dim with colour tokens.');
    } else if (!markerClass.test(token) && !isKnown(state, token)) {
      report('unknown', 'compiles to no CSS under the CSPS theme (a cleared Tailwind default or a typo).');
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------------------------
// Sweeping the app source
// ---------------------------------------------------------------------------------------------------------------

/**
 * Every `src/**\/*.{ts,tsx}` file the gate covers, relative to web/ with forward slashes, sorted. Tests, src/test
 * and declaration files are left out (Tailwind does not scan them either).
 * @param {string} [webRoot]
 * @returns {string[]}
 */
export function listSourceFiles(webRoot = defaultWebRoot) {
  return readdirSync(path.join(webRoot, 'src'), { recursive: true, encoding: 'utf8' })
    .map((name) => `src/${name.replaceAll('\\', '/')}`)
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !/\.test\.tsx?$|\.d\.ts$/.test(file) && !file.startsWith('src/test/'))
    .sort();
}

/**
 * A program over the gate's files, only for resolving imports (`@/` paths and barrels); nothing is type-checked.
 * @param {string} webRoot
 * @param {readonly string[]} files
 */
function createSourceProgram(webRoot, files) {
  return ts.createProgram(
    files.map((file) => path.join(webRoot, file)),
    {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      paths: { '@/*': [path.join(webRoot, 'src', '*')] },
      noEmit: true,
      skipLibCheck: true,
      types: [],
    },
  );
}

/** @param {string} file */
const posix = (file) => file.replaceAll('\\', '/');

/**
 * Runs the gate over every source file. A class constant imported from another src module that is not a recipe (whose
 * strings are all read anyway) is read and checked in the module that declares it (TOOL-WR-06).
 * @param {string} [webRoot]
 * @returns {Promise<ClassFinding[]>}
 */
export async function runClassGate(webRoot = defaultWebRoot) {
  const files = listSourceFiles(webRoot);
  const program = createSourceProgram(webRoot, files);
  const checker = program.getTypeChecker();
  const root = posix(path.resolve(webRoot)).replace(/\/$/, '');
  const listed = new Set(files);
  /** Foreign class constants already read: declaration → its file and tokens. @type {Map<ts.Node, { file: string, tokens: ClassToken[] }>} */
  const foreign = new Map();

  /** @type {UnresolvedIdentifier} */
  const onUnresolved = (identifier) => {
    let symbol = checker.getSymbolAtLocation(identifier);
    if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (
      declaration === undefined ||
      !ts.isVariableDeclaration(declaration) ||
      declaration.initializer === undefined ||
      foreign.has(declaration)
    ) {
      return;
    }
    const declaringFile = declaration.getSourceFile();
    const absolute = posix(declaringFile.fileName);
    const file = absolute.toLowerCase().startsWith(`${root.toLowerCase()}/`) ? absolute.slice(root.length + 1) : '';
    if (!listed.has(file) || file.endsWith('.recipe.ts') || declaringFile === identifier.getSourceFile()) {
      return;
    }
    const entry = { file, tokens: /** @type {ClassToken[]} */ ([]) };
    foreign.set(declaration, entry);
    entry.tokens.push(...collectExpressionTokens(declaringFile, declaration.initializer, onUnresolved));
  };

  /** @type {ClassFinding[]} */
  const findings = [];
  for (const file of files) {
    const sourceFile = program.getSourceFile(path.join(webRoot, file));
    const tokens = collectClassTokens(file, readFileSync(path.join(webRoot, file), 'utf8'), {
      ...(sourceFile === undefined ? {} : { sourceFile }),
      onUnresolved,
    });
    findings.push(...(await checkClassTokens(tokens, { file })));
  }
  for (const { file, tokens } of foreign.values()) {
    findings.push(...(await checkClassTokens(tokens, { file })));
  }
  // A constant also used in a class position of its own file is read by both walks; report each finding once.
  const unique = new Map(findings.map((finding) => [finding.message, finding]));
  return [...unique.values()];
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  const findings = await runClassGate();
  for (const finding of findings) {
    process.stderr.write(`class-gate: ${finding.message}\n`);
  }
  process.exitCode = findings.length === 0 ? 0 : 1;
}
