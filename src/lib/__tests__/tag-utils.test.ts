import { describe, expect, it } from 'vitest';

import { getTagColor } from '../tag-utils';

const neutralTagClasses = [
  'bg-zinc-900 text-zinc-300 border-zinc-700',
  'bg-zinc-950 text-zinc-300 border-zinc-700',
  'bg-zinc-900/80 text-zinc-400 border-zinc-800',
];

describe('getTagColor', () => {
  it('returns a valid Tailwind class string', () => {
    const color = getTagColor('javascript');
    expect(neutralTagClasses).toContain(color);
  });

  it('returns the same color for the same tag', () => {
    const first = getTagColor('react');
    const second = getTagColor('react');
    expect(first).toBe(second);
  });

  it('is deterministic across multiple calls', () => {
    const tags = ['typescript', 'python', 'rust', 'go', 'java'];
    const firstRound = tags.map(getTagColor);
    const secondRound = tags.map(getTagColor);
    expect(firstRound).toEqual(secondRound);
  });

  it('handles empty string', () => {
    const color = getTagColor('');
    expect(neutralTagClasses).toContain(color);
  });

  it('handles single character tags', () => {
    const color = getTagColor('a');
    expect(neutralTagClasses).toContain(color);
  });

  it('returns different colors for different tags (not guaranteed but likely)', () => {
    // With three neutral tones and many tags, we expect at least two distinct values.
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const colors = new Set(tags.map(getTagColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('handles special characters in tag names', () => {
    const color = getTagColor('c++');
    expect(neutralTagClasses).toContain(color);
  });

  it('handles unicode characters', () => {
    const color = getTagColor('cafe\u0301');
    expect(neutralTagClasses).toContain(color);
  });

  it('returns one of the predefined color values', () => {
    const color = getTagColor('test-tag');
    expect(neutralTagClasses).toContain(color);
  });
});
