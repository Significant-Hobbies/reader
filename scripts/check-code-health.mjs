#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(currentFile), '..');
const productionPaths = [
  'src',
  'scripts',
  'packages/chrome-extension/src',
  'landing-astro/src',
  'vite.config.ts',
  'vitest.config.ts',
  'drizzle.config.ts',
];
const sourceExtensions = new Set(['.astro', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx']);

const baselines = {
  lintWarnings: 39,
  complexity: { violations: 37, maxCcn: 68, maxLength: 606, maxParams: 11 },
  duplication: { clones: 37, duplicatedLines: 493 },
  unused: {
    files: 0,
    exports: 0,
    types: 0,
    dependencies: 0,
    devDependencies: 0,
    unlisted: 0,
    unresolved: 0,
  },
  suppressions: 5,
};

function checkLint() {
  const report = parseJson(
    run('pnpm', ['exec', 'biome', 'check', '.', '--reporter=json', '--max-diagnostics=none']),
    'Biome'
  );
  const errors = report.summary?.errors ?? 0;
  const warnings = report.summary?.warnings ?? 0;
  console.log(
    `Lint: ${errors} errors, ${warnings} warnings across ${report.summary?.unchanged ?? 0} files.`
  );
  if (errors > 0) throw new Error(`Lint errors detected: ${errors}`);
  if (warnings > baselines.lintWarnings) {
    throw new Error(`Lint warnings regressed: ${warnings} > ${baselines.lintWarnings}.`);
  }
  if (warnings < baselines.lintWarnings) {
    console.log('Lint warnings improved; lower the checked-in baseline intentionally.');
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function parseJson(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    process.stderr.write(result.stderr);
    throw new Error(`${label} did not return valid JSON`, { cause: error });
  }
}

function commandWithUvx(command, uvxArgs) {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? { command, prefix: [] } : { command: 'uvx', prefix: uvxArgs };
}

function issueCount(issues, key) {
  return issues.reduce((sum, issue) => sum + (issue[key]?.length ?? 0), 0);
}

function failRegressions(label, observed, baseline) {
  const regressions = Object.entries(baseline).filter(([key, maximum]) => observed[key] > maximum);
  if (regressions.length > 0) {
    throw new Error(
      regressions
        .map(([key, maximum]) => `${label} ${key} regressed: ${observed[key]} > ${maximum}`)
        .join('\n')
    );
  }
  if (Object.entries(baseline).some(([key, maximum]) => observed[key] < maximum)) {
    console.log(`${label} improved; lower the checked-in baseline intentionally.`);
  }
}

function checkUnused() {
  const report = parseJson(
    run('pnpm', ['exec', 'knip', '--reporter', 'json', '--no-exit-code', '--no-progress'], {
      allowFailure: true,
    }),
    'Knip'
  );
  const issues = report.issues ?? [];
  const observed = Object.fromEntries(
    Object.keys(baselines.unused).map((key) => [key, issueCount(issues, key)])
  );
  console.log(
    `Unused: files=${observed.files}, exports=${observed.exports}, types=${observed.types}, ` +
      `dependencies=${observed.dependencies}, devDependencies=${observed.devDependencies}, ` +
      `unlisted=${observed.unlisted}, unresolved=${observed.unresolved}.`
  );
  failRegressions('Unused', observed, baselines.unused);
}

function checkComplexity() {
  const lizard = commandWithUvx('lizard', ['--from', 'lizard==1.23.0', 'lizard']);
  const result = run(lizard.command, [
    ...lizard.prefix,
    ...productionPaths,
    '-x',
    '**/*.test.*',
    '-x',
    '**/__tests__/**',
    '-x',
    'src/agent-edge.mjs',
    '-x',
    'scripts/check-code-health.mjs',
    '-x',
    '**/*.d.ts',
    '--csv',
  ]);
  const rows = result.stdout
    .trim()
    .split('\n')
    .map((line) => line.match(/^(\d+),(\d+),(\d+),(\d+),(\d+),/u))
    .filter(Boolean)
    .map((match) => match.slice(1).map(Number));
  const observed = {
    functions: rows.length,
    nloc: rows.reduce((sum, row) => sum + row[0], 0),
    violations: rows.filter((row) => row[1] > 15 || row[4] > 100 || row[3] > 7).length,
    maxCcn: Math.max(...rows.map((row) => row[1])),
    maxLength: Math.max(...rows.map((row) => row[4])),
    maxParams: Math.max(...rows.map((row) => row[3])),
  };
  console.log(
    `Complexity: ${observed.functions} functions, ${observed.nloc} NLOC, ` +
      `${observed.violations} violations; max CCN ${observed.maxCcn}, ` +
      `max length ${observed.maxLength}, max params ${observed.maxParams}.`
  );
  failRegressions('Complexity', observed, baselines.complexity);
}

function checkDuplication() {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'reader-jscpd-'));
  run('pnpm', [
    'exec',
    'jscpd',
    ...productionPaths,
    '--min-lines',
    '8',
    '--min-tokens',
    '60',
    '--mode',
    'strict',
    '--ignore',
    '**/*.test.*,**/__tests__/**,**/*.d.ts,**/node_modules/**,**/dist/**,**/coverage/**,src/agent-edge.mjs,scripts/check-code-health.mjs',
    '--reporters',
    'json',
    '--output',
    outputDirectory,
    '--silent',
    '--no-tips',
  ]);
  const observed = JSON.parse(readFileSync(join(outputDirectory, 'jscpd-report.json'), 'utf8'))
    .statistics.total;
  console.log(
    `Duplication: ${observed.clones} groups, ${observed.duplicatedLines}/${observed.lines} lines ` +
      `(${observed.percentage.toFixed(4)}%) across ${observed.sources} files.`
  );
  failRegressions('Duplication', observed, baselines.duplication);
}

function checkCycles() {
  const report = parseJson(
    run(
      'pnpm',
      ['exec', 'knip', '--cycles', '--reporter', 'json', '--no-exit-code', '--no-progress'],
      { allowFailure: true }
    ),
    'Knip cycle analysis'
  );
  const cycles = (report.issues ?? []).flatMap((issue) => issue.cycles ?? []);
  if (cycles.length > 0) throw new Error(`Dependency cycles detected: ${cycles.length}`);
  console.log('Cycles: zero JavaScript or TypeScript import cycles.');
}

function checkDependencies() {
  const report = parseJson(run('pnpm', ['audit', '--json'], { allowFailure: true }), 'pnpm audit');
  // Astro 5 debt accepted only until the major-upgrade issue is resolved: #42.
  const accepted = new Set(['GHSA-8hv8-536x-4wqp', 'GHSA-2pvr-wf23-7pc7']);
  const severe = Object.values(report.advisories ?? {}).filter((advisory) =>
    ['critical', 'high'].includes(advisory.severity)
  );
  const unexpected = severe.filter((advisory) => !accepted.has(advisory.github_advisory_id));
  const critical = severe.filter((advisory) => advisory.severity === 'critical').length;
  const high = severe.filter((advisory) => advisory.severity === 'high').length;
  console.log(
    `Dependencies: ${critical} critical, ${high} high, ${unexpected.length} unexpected; ` +
      `${severe.length - unexpected.length} accepted Astro 5 advisories.`
  );
  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected critical/high advisories: ${unexpected
        .map((advisory) => advisory.github_advisory_id)
        .join(', ')}`
    );
  }
}

const suppressionPattern =
  /biome-ignore|eslint-disable|@ts-ignore|@ts-expect-error|istanbul ignore|c8 ignore|(?:test|base)\.skip\(|\bTODO\b|\bFIXME\b/u;

function sourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function checkSuppressions() {
  const files = [
    'src',
    'scripts',
    'tests',
    'packages/chrome-extension/src',
    'landing-astro/src',
  ].flatMap((root) => sourceFiles(resolve(projectRoot, root)));
  const matches = files
    .filter((file) => file !== currentFile)
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => suppressionPattern.test(line))
    );
  console.log(`Suppressions: ${matches.length} justified source/test markers.`);
  if (matches.length > baselines.suppressions) {
    throw new Error(`Suppressions regressed: ${matches.length} > ${baselines.suppressions}.`);
  }
  if (matches.length < baselines.suppressions) {
    console.log('Suppressions improved; lower the checked-in baseline intentionally.');
  }
}

function checkHygiene() {
  const parent = run('git', ['rev-parse', '--verify', 'HEAD^'], { allowFailure: true });
  if (parent.status === 0) run('git', ['diff', '--check', 'HEAD^', 'HEAD']);
  else run('git', ['diff-tree', '--check', '--root', '-r', 'HEAD']);
  run('git', ['diff', '--check', 'HEAD', '--', '.']);
  const conflicts = run('git', ['grep', '-nE', '^(<<<<<<< |=======|>>>>>>> )', '--', '.'], {
    allowFailure: true,
  });
  if (conflicts.status === 0) throw new Error(`Conflict markers found:\n${conflicts.stdout}`);
  if (conflicts.status > 1) throw new Error(`git grep failed with status ${conflicts.status}`);

  const generated = run('git', ['ls-files', '--others', '--exclude-standard'])
    .stdout.trim()
    .split('\n')
    .filter(Boolean)
    .filter((file) =>
      /(^|\/)(?:coverage|dist|build|\.next|\.open-next|\.wrangler)(?:\/|$)|(?:^|\/)\.DS_Store$|\.tsbuildinfo$|web-annotator-extension-.*\.zip$/u.test(
        file
      )
    );
  if (generated.length > 0) {
    throw new Error(`Untracked generated artifacts found: ${generated.join(', ')}`);
  }
  console.log('Repository hygiene: whitespace, conflicts, and generated outputs pass.');
}

const checks = {
  lint: checkLint,
  unused: checkUnused,
  complexity: checkComplexity,
  duplication: checkDuplication,
  cycles: checkCycles,
  dependencies: checkDependencies,
  suppressions: checkSuppressions,
  hygiene: checkHygiene,
};
const selected = process.argv[2];

if (!Object.hasOwn(checks, selected)) {
  console.error(`Usage: check-code-health.mjs <${Object.keys(checks).join('|')}>`);
  process.exit(2);
}

try {
  checks[selected]();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
