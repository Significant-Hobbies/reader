import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { expect, test } from 'vitest';

import { parseFeed } from '../rss-parser';

const SIZES = [10, 100, 200];
const ITERATIONS = 25;
const EXPECTED_HASHES = new Map([
  [10, 'e2c04d0f621e652d5cf5e180862d5ef0d3e420414fc6dd2766aa638cdd255d02'],
  [100, 'bcc8798f918ca05af112d4a6c74f1defa2ae4073c4675bdcd65fb84dc91c2da9'],
  [200, 'bb8a0c80775d61191a5ee3a23ea651a5b32b777250478821040a84cbce6148c0'],
]);

test('RSS parsing scales across supported feed sizes', { timeout: 30_000 }, () => {
  const metrics: string[] = [];

  for (const size of SIZES) {
    const xml = buildFeed(size);
    const expected = JSON.stringify(parseFeed(xml));
    const expectedHash = createHash('sha256').update(expected).digest('hex');
    expect(expectedHash).toBe(EXPECTED_HASHES.get(size));
    let durationMs = 0;

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const startedAt = performance.now();
      const parsed = parseFeed(xml);
      durationMs += performance.now() - startedAt;
      expect(JSON.stringify(parsed)).toBe(expected);
      expect(createHash('sha256').update(JSON.stringify(parsed)).digest('hex')).toBe(expectedHash);
    }

    metrics.push(`size${size}=${(durationMs / ITERATIONS).toFixed(3)}ms/op`);
  }

  console.log(`[benchmark] ${metrics.join(' ')} (${ITERATIONS} iterations)`);
  console.log(`[resource] maximum_supported_entries=${SIZES.at(-1)}`);
});

function buildFeed(size: number): string {
  const items = Array.from({ length: size }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, '0');
    return `<item>
      <guid>entry-${index}</guid>
      <title>Research update ${index} &amp; notes</title>
      <link>https://example.com/articles/${index}?source=reader</link>
      <author>Author ${index % 20}</author>
      <pubDate>Mon, ${day} Jul 2026 00:00:00 GMT</pubDate>
      <description><![CDATA[
        <article><h2>Finding ${index}</h2><p>This is a useful research summary with
        <strong>evidence</strong>, context, and follow-up details for the Reader library.</p>
        <p>Additional paragraph ${index} with <a href="https://example.com/source/${index}">source</a>.</p>
        <script>ignored(${index})</script></article>
      ]]></description>
    </item>`;
  }).join('');

  return `<?xml version="1.0"?><rss version="2.0"><channel>
    <title>Reader performance feed</title>
    <link>https://example.com/</link>
    ${items}
  </channel></rss>`;
}
