import { describe, expect, it } from 'vitest';

import { createEntryExternalId, parseFeed, parseOpml } from '../rss-parser';

describe('parseOpml', () => {
  it('imports nested outlines and deduplicates feed URLs', () => {
    const opml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="Folder">
        <outline type="rss" title="Example" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com/" />
        <outline type="rss" title="Duplicate" xmlUrl="https://example.com/feed.xml" />
      </outline>
    </body></opml>`;

    expect(parseOpml(opml)).toEqual([
      {
        title: 'Example',
        feedUrl: 'https://example.com/feed.xml',
        siteUrl: 'https://example.com/',
      },
    ]);
  });

  it('rejects malformed or feedless input', () => {
    expect(() => parseOpml('<html />')).toThrow('Invalid OPML');
    expect(() => parseOpml('<opml><body /></opml>')).toThrow('no valid feeds');
  });
});

describe('parseFeed', () => {
  it('normalizes RSS 2.0 items and sanitizes content', () => {
    const rss = `<?xml version="1.0"?><rss version="2.0"><channel>
      <title>Example RSS</title><link>https://example.com/</link>
      <item><guid>post-1</guid><title>First &amp; best</title><link>https://example.com/first</link>
      <author>Ada</author><pubDate>Mon, 13 Jul 2026 00:00:00 GMT</pubDate>
      <description><![CDATA[<p>Hello <strong>world</strong></p><script>alert(1)</script>]]></description></item>
    </channel></rss>`;

    const feed = parseFeed(rss);
    expect(feed.title).toBe('Example RSS');
    expect(feed.entries[0]).toMatchObject({
      externalId: 'post-1',
      title: 'First & best',
      url: 'https://example.com/first',
      author: 'Ada',
      excerpt: 'Hello world',
    });
    expect(feed.entries[0].content).not.toContain('<script');
  });

  it('normalizes Atom entries and alternate links', () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <title>Example Atom</title><link rel="alternate" href="https://example.com/" />
      <entry><id>tag:example.com,2026:1</id><title>Atom post</title>
      <link rel="alternate" href="https://example.com/atom-post" />
      <author><name>Grace</name></author><updated>2026-07-12T10:00:00Z</updated>
      <summary>Useful summary</summary></entry>
    </feed>`;

    expect(parseFeed(atom)).toMatchObject({
      title: 'Example Atom',
      siteUrl: 'https://example.com/',
      entries: [
        {
          externalId: 'tag:example.com,2026:1',
          title: 'Atom post',
          url: 'https://example.com/atom-post',
          author: 'Grace',
          excerpt: 'Useful summary',
        },
      ],
    });
  });

  it('creates stable fallback IDs and rejects unsupported XML', () => {
    const input = { title: 'Same post', url: 'https://example.com/post' };
    expect(createEntryExternalId(input)).toBe(createEntryExternalId(input));
    expect(() => parseFeed('<catalog><item /></catalog>')).toThrow('Unsupported');
  });
});
