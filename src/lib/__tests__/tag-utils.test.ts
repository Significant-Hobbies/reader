import { describe, it, expect } from 'vitest';
import { getTagColor } from '../tag-utils';

describe('getTagColor', () => {
  it('returns a valid Tailwind class string', () => {
    const color = getTagColor('javascript');
    expect(color).toMatch(/^bg-\w+-900\/50 text-\w+-200 border-\w+-700$/);
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
    expect(color).toMatch(/^bg-\w+-900\/50 text-\w+-200 border-\w+-700$/);
  });

  it('handles single character tags', () => {
    const color = getTagColor('a');
    expect(color).toMatch(/^bg-\w+-900\/50 text-\w+-200 border-\w+-700$/);
  });

  it('returns different colors for different tags (not guaranteed but likely)', () => {
    // With 10 colors and many tags, we expect at least 2 distinct colors
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const colors = new Set(tags.map(getTagColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('handles special characters in tag names', () => {
    const color = getTagColor('c++');
    expect(color).toMatch(/^bg-\w+-900\/50 text-\w+-200 border-\w+-700$/);
  });

  it('handles unicode characters', () => {
    const color = getTagColor('cafe\u0301');
    expect(color).toMatch(/^bg-\w+-900\/50 text-\w+-200 border-\w+-700$/);
  });

  it('returns one of the predefined color values', () => {
    const validColors = [
      'bg-blue-900/50 text-blue-200 border-blue-700',
      'bg-green-900/50 text-green-200 border-green-700',
      'bg-purple-900/50 text-purple-200 border-purple-700',
      'bg-pink-900/50 text-pink-200 border-pink-700',
      'bg-yellow-900/50 text-yellow-200 border-yellow-700',
      'bg-red-900/50 text-red-200 border-red-700',
      'bg-indigo-900/50 text-indigo-200 border-indigo-700',
      'bg-cyan-900/50 text-cyan-200 border-cyan-700',
      'bg-orange-900/50 text-orange-200 border-orange-700',
      'bg-teal-900/50 text-teal-200 border-teal-700',
    ];
    const color = getTagColor('test-tag');
    expect(validColors).toContain(color);
  });
});
