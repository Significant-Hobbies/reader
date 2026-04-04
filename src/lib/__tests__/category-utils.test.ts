import { describe, it, expect } from 'vitest';
import { getCategoryColor, SUGGESTED_CATEGORIES } from '../category-utils';

describe('SUGGESTED_CATEGORIES', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(SUGGESTED_CATEGORIES)).toBe(true);
    expect(SUGGESTED_CATEGORIES.length).toBeGreaterThan(0);
    SUGGESTED_CATEGORIES.forEach((cat) => {
      expect(typeof cat).toBe('string');
    });
  });

  it('contains expected categories', () => {
    expect(SUGGESTED_CATEGORIES).toContain('Research');
    expect(SUGGESTED_CATEGORIES).toContain('Tutorial');
    expect(SUGGESTED_CATEGORIES).toContain('Blog Post');
    expect(SUGGESTED_CATEGORIES).toContain('Documentation');
    expect(SUGGESTED_CATEGORIES).toContain('News');
  });

  it('has no duplicate entries', () => {
    const uniqueCategories = new Set(SUGGESTED_CATEGORIES);
    expect(uniqueCategories.size).toBe(SUGGESTED_CATEGORIES.length);
  });
});

describe('getCategoryColor', () => {
  it('returns a valid color name', () => {
    const validColors = [
      'blue',
      'cyan',
      'green',
      'yellow',
      'orange',
      'red',
      'pink',
      'purple',
      'indigo',
    ];
    const color = getCategoryColor('Research');
    expect(validColors).toContain(color);
  });

  it('returns the same color for the same category', () => {
    const first = getCategoryColor('Tutorial');
    const second = getCategoryColor('Tutorial');
    expect(first).toBe(second);
  });

  it('is deterministic across multiple calls', () => {
    const categories = ['Research', 'Blog Post', 'News'];
    const firstRound = categories.map(getCategoryColor);
    const secondRound = categories.map(getCategoryColor);
    expect(firstRound).toEqual(secondRound);
  });

  it('handles empty string', () => {
    const validColors = [
      'blue',
      'cyan',
      'green',
      'yellow',
      'orange',
      'red',
      'pink',
      'purple',
      'indigo',
    ];
    const color = getCategoryColor('');
    expect(validColors).toContain(color);
  });

  it('handles categories not in the suggested list', () => {
    const validColors = [
      'blue',
      'cyan',
      'green',
      'yellow',
      'orange',
      'red',
      'pink',
      'purple',
      'indigo',
    ];
    const color = getCategoryColor('Custom Category');
    expect(validColors).toContain(color);
  });

  it('produces varied colors for different inputs', () => {
    const categories = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const colors = new Set(categories.map(getCategoryColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('handles special characters', () => {
    const validColors = [
      'blue',
      'cyan',
      'green',
      'yellow',
      'orange',
      'red',
      'pink',
      'purple',
      'indigo',
    ];
    const color = getCategoryColor('How-To / Guide');
    expect(validColors).toContain(color);
  });

  it('maps all suggested categories to valid colors', () => {
    const validColors = [
      'blue',
      'cyan',
      'green',
      'yellow',
      'orange',
      'red',
      'pink',
      'purple',
      'indigo',
    ];
    SUGGESTED_CATEGORIES.forEach((cat) => {
      expect(validColors).toContain(getCategoryColor(cat));
    });
  });
});
