import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type BrowserMemorySnapshotInput,
  sanitizeBrowserMemorySnapshot,
} from './browser-memory-import';
import {
  type MemoryCapture,
  type MemoryCaptureInput,
  normalizeMemoryCapture,
} from './memory-capture';

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const MEMORY_CAPTURES_FIXTURE = path.join(FIXTURE_DIR, 'memory-captures.json');
const BROWSER_MEMORY_FIXTURE = path.join(FIXTURE_DIR, 'browser-memory-snapshots.json');

export function loadMemoryCaptureFixture(): {
  captures: MemoryCaptureInput[];
  demoQueries: Record<string, string>;
} {
  const raw = JSON.parse(readFileSync(MEMORY_CAPTURES_FIXTURE, 'utf8')) as {
    captures: MemoryCaptureInput[];
    demoQueries?: Record<string, string>;
  };
  return { captures: raw.captures, demoQueries: raw.demoQueries ?? {} };
}

export function loadBrowserMemoryFixtureSnapshots(): BrowserMemorySnapshotInput[] {
  const raw = JSON.parse(readFileSync(BROWSER_MEMORY_FIXTURE, 'utf8')) as {
    snapshots: BrowserMemorySnapshotInput[];
  };
  return raw.snapshots;
}

/** Fixture-backed ingest for web, blog, and PDF-like captures (no extension permissions). */
export function ingestMemoryCaptureFixtures(): MemoryCapture[] {
  const { captures } = loadMemoryCaptureFixture();
  return captures
    .map((input) => normalizeMemoryCapture(input))
    .filter((c): c is MemoryCapture => c !== null);
}

/**
 * Browser-memory style batch import mock: sanitizes extension snapshots from fixture
 * and maps them into the same in-memory capture shape as typed fixtures.
 */
export function mockBrowserMemoryImport(): {
  captures: MemoryCapture[];
  errors: { url: string; reason: string }[];
} {
  const snapshots = loadBrowserMemoryFixtureSnapshots();
  const captures: MemoryCapture[] = [];
  const errors: { url: string; reason: string }[] = [];

  snapshots.forEach((snap, index) => {
    const parsed = sanitizeBrowserMemorySnapshot(snap);
    if ('error' in parsed) {
      errors.push({ url: String(snap.url ?? '(unknown)'), reason: parsed.error });
      return;
    }
    const { snapshot } = parsed;
    const visitedAt =
      typeof snap.visitedAt === 'string' ? snap.visitedAt : '2026-06-04T12:00:00.000Z';
    const normalized = normalizeMemoryCapture({
      id: `browser-memory-${index}`,
      kind: 'web_page',
      url: snapshot.url,
      title: snapshot.title,
      content: snapshot.content,
      siteName: snapshot.siteName,
      capturedAt: visitedAt,
      tags: ['browser-memory'],
    });
    if (normalized) captures.push(normalized);
  });

  return { captures, errors };
}

export function buildPrototypeCorpus(): MemoryCapture[] {
  const typed = ingestMemoryCaptureFixtures();
  const { captures: imported } = mockBrowserMemoryImport();
  const byUrl = new Map<string, MemoryCapture>();
  for (const capture of [...typed, ...imported]) {
    byUrl.set(capture.url, capture);
  }
  return Array.from(byUrl.values()).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
